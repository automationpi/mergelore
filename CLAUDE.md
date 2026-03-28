# mergelore — Claude Code Project Memory

## What mergelore is

mergelore is a GitHub Action that gives every PR **institutional memory** — surfacing past architectural decisions, reversed patterns, and constraint violations that AI-generated code silently re-introduces.

### The problem it solves

In 2025, 41% of all code shipped was AI-generated or assisted, carrying 1.7× more defects per PR than human-written code. PR review time increased 91% despite faster code generation. The root cause: AI coding tools (Claude Code, Copilot, Cursor) generate code that looks correct in isolation but have **zero awareness of your team's history** — the decisions made in past PRs, the patterns deliberately removed, the limits load-tested and hardcoded.

Every existing tool (CodeRabbit, Copilot Review, Qodo, Greptile) reviews the **present diff**. None of them have episodic memory of *why* past decisions were made. This gap is called the **"Decision Shadow"** (arXiv:2603.15566, March 2026) — the reasoning behind a commit is discarded even though the code change is preserved.

mergelore is the institutional memory layer that bridges that gap.

### The one-line pitch

> "Give your PRs the institutional memory that AI-generated code lacks."

---

## Origin and inspiration

- Conceptualised during a conversation about novel GitHub Actions at the intersection of AI and human-in-the-loop workflows
- Named after extensive research confirming it is clean across GitHub, Docker Hub, npm, PyPI, and GitHub Marketplace
- Previously explored names (all eliminated — taken or conflicting): vigil, driftguard, repolens, gitlore, codewitness, prchive, sentinel, scribe, pr-recall
- The "Decision Shadow" concept from the Lore research paper (arXiv 2025) is the academic foundation
- Cursor's $290M acquisition of Graphite (Dec 2025) confirms the market bet that review is the next constraint after code generation
- Designed for the age of agentic AI — Claude Code, Codex, Cursor opening PRs autonomously

---

## Architecture — non-negotiable principles

### The async boundary (most important)

```
CI runtime (GitHub Actions runner)     |     Indexer runtime (independent)
─────────────────────────────────────────────────────────────────────────
PR opened → diff extracted             |     PR merged → embedding model
→ query vector store (read only)       |     → write to vector store
→ LLM analysis (diff + context)        |     → ingest human feedback
→ PR comment posted                    |     → re-index on override
```

**The Action NEVER runs the embedding model. The indexer NEVER posts PR comments. These runtimes must stay decoupled forever.**

### Plugin architecture — two contracts, nothing else

```typescript
// Everything plugs into these two interfaces. Never bypass them.

interface LLMProvider {
  analyze(diff: Diff, context: Context[]): Promise<Finding[]>
}

interface MemoryProvider {
  index(pr: MergedPR): Promise<void>
  query(diff: Diff): Promise<Context[]>
}
```

### Three tiers — users graduate between them

| Tier | Memory provider | Infra needed | Who uses it |
|------|----------------|--------------|-------------|
| 0 | `none` | Zero — just an API key | First-time users, small repos |
| 1 | `git-native` | None — GitHub API only | Most teams |
| 2 | `qdrant` or `pgvector` | Qdrant pod or managed DB | Platform teams, regulated orgs |

**Users start at tier 0 and opt into complexity. Never force them upward.**

---

## Repository structure

```
mergelore/
├── action/                     # GitHub Action (TypeScript / Node 20)
│   ├── action.yml              # Action manifest
│   ├── src/
│   │   ├── index.ts            # Main runner — thin orchestrator
│   │   ├── diff.ts             # Git diff extraction
│   │   ├── comment.ts          # PR comment formatter
│   │   ├── providers/
│   │   │   ├── llm/
│   │   │   │   ├── interface.ts
│   │   │   │   ├── claude.ts   # Default — Anthropic API
│   │   │   │   └── openai.ts
│   │   │   └── memory/
│   │   │       ├── interface.ts
│   │   │       ├── none.ts
│   │   │       ├── git-native.ts
│   │   │       └── qdrant.ts
│   │   └── types.ts
│   └── tests/
├── indexer/                    # Async embedding service (Python 3.12)
│   ├── Dockerfile
│   ├── main.py
│   ├── embed.py                # Embedding model abstraction
│   ├── store.py                # Vector store abstraction
│   └── webhook.py              # Optional GitHub webhook receiver
├── helm/                       # Helm chart for full-stack deploy
│   └── mergelore/
│       ├── Chart.yaml
│       ├── values.yaml
│       └── templates/
│           ├── action-deployment.yaml
│           ├── indexer-deployment.yaml
│           ├── qdrant-deployment.yaml
│           └── webhook-deployment.yaml
├── .claude/                    # Claude Code configuration
│   ├── agents/
│   │   └── recall-check.md
│   ├── commands/
│   │   ├── recall.md
│   │   └── recall-index.md
│   ├── hooks/
│   │   ├── pre-pr-check.js
│   │   └── post-pr-attach.js
│   ├── skills/
│   │   ├── provider-pattern.md
│   │   └── testing-strategy.md
│   └── settings.json
├── docs/
│   ├── ARCHITECTURE.md
│   ├── PROVIDERS.md
│   ├── HELM.md
│   └── DOCKER.md
├── CLAUDE.md                   # This file
└── README.md
```

---

## Stack decisions — rationale included

| Decision | Choice | Why |
|----------|--------|-----|
| Action runtime | TypeScript / Node 20 | GitHub Actions native, fast cold start, good Octokit support |
| Indexer runtime | Python 3.12 | Best embedding library ecosystem (sentence-transformers, qdrant-client) |
| Webhook receiver | Go / scratch base | Tiny image, high throughput, no runtime deps |
| Default LLM | Claude Sonnet (Anthropic) | Best structured reasoning over retrieved context |
| Default embedding | text-embedding-3-small | Low cost, 1536d, well-tested in RAG workloads |
| Self-hosted embedding | nomic-embed-text v1.5 | Apache-2, CPU-friendly, 768d, zero cost |
| Vector store | Qdrant | Rust-native, excellent filtering, clean REST API, strong Helm chart |
| Managed alt | pgvector (Supabase / Neon) | Teams already on Postgres avoid new infra |
| Container registry primary | GHCR (ghcr.io/automationpi/) | No rate limits with GITHUB_TOKEN in CI |
| Container registry discovery | Docker Hub (mergelore/) | Public search, discoverability |
| Image signing | Cosign / Sigstore keyless | Supply chain compliance for regulated industries |
| Multi-arch | linux/amd64 + linux/arm64 | AKS ARM node pools, Apple Silicon dev machines |

---

## Docker images

Three images, one per runtime boundary:

```
mergelore/action    — Node 20 Alpine  — CI runner, must be tiny (<50MB target)
mergelore/indexer   — Python 3.12 slim — async embedding service
mergelore/webhook   — Go scratch       — optional real-time webhook receiver
```

Tag strategy: `latest` | `v0.1.0` | `sha-<commit>` | `edge`

**Helm chart default:** pull from `ghcr.io/automationpi/` — override with `image.repository` in values.yaml for Docker Hub.

---

## action.yml — locked schema

```yaml
name: mergelore
description: Institutional memory for AI-generated PRs
author: automationpi

inputs:
  anthropic-api-key:
    description: Anthropic API key
    required: true
  memory-provider:
    description: none | git-native | qdrant
    default: git-native
  llm-provider:
    description: claude | openai
    default: claude
  history-depth:
    description: Number of past PRs to retrieve (git-native mode)
    default: '20'
  confidence-threshold:
    description: Minimum score to post a flag (0.0–1.0)
    default: '0.7'
  vector-store-url:
    description: Qdrant or pgvector URL (qdrant provider only)
    required: false
  block-on-critical:
    description: Fail CI on critical findings
    default: 'false'

runs:
  using: node20
  main: action/dist/index.js
```

---

## PR comment format — never change this structure

Every comment mergelore posts must follow this exact structure:

```markdown
## mergelore findings

> Reviewed {N} past PRs · {M} relevant decisions found · confidence threshold {T}

### ⚠️ Potential conflicts

**[TITLE]** · confidence: 0.XX
> [Plain language explanation of what was decided before and why this PR may conflict]
> Source: [PR #NNN]({link}) · {date}

`/mergelore-acknowledge` · `/mergelore-override [reason]` · `/mergelore-update-record`

---

### ℹ️ Related context

[Relevant historical decisions that are informational, not blocking]

---
*mergelore v{version} · [docs](https://github.com/automationpi/mergelore)*
```

**Findings are suggestions, never hard blocks unless `block-on-critical: true` is explicitly set.**

---

## Critical rules — read before every task

1. **Never run embedding in the Action.** The CI runner must stay fast. Embedding belongs in the indexer only.
2. **Never post PR comments from the indexer.** Only the Action touches GitHub PRs.
3. **All LLM calls use structured output.** Never parse free text responses. Use JSON schema / tool use.
4. **Confidence scores are mandatory on every Finding.** Never post without a score.
5. **Human overrides are data.** When a human runs `/mergelore-override`, write that decision back to the memory store with the reason.
6. **`block-on-critical` is opt-in only.** Default is comment-only, never block.
7. **Providers are stateless.** No singleton state in any provider implementation.
8. **The two interfaces are sacred.** `LLMProvider` and `MemoryProvider` must never be bypassed.
9. **Tests are not optional.** Every provider gets an integration test against a real API (using test keys from environment).
10. **Image size matters.** The `action` image must stay under 50MB. Run `docker images` and check before every release.

---

## Adding a new LLM provider

1. Create `action/src/providers/llm/{name}.ts`
2. Implement `LLMProvider` interface — `analyze(diff, context): Promise<Finding[]>`
3. Return structured `Finding[]` — never return raw LLM text
4. Add to provider factory in `action/src/index.ts`
5. Add integration test in `action/tests/providers/llm/{name}.test.ts`
6. Add entry in `docs/PROVIDERS.md`
7. Add `{name}` as valid option in `action.yml` inputs description

## Adding a new memory provider

1. Create `action/src/providers/memory/{name}.ts`
2. Implement `MemoryProvider` interface — `index(pr)` and `query(diff)`
3. Providers must be stateless — no class-level state
4. `query()` must return `Context[]` sorted by relevance score descending
5. Add integration test in `action/tests/providers/memory/{name}.test.ts`
6. Add entry in `docs/PROVIDERS.md`

---

## Target users — always design for all three

1. **Solo developer / small team** — wants to add one block of YAML to their workflow, provide an API key, and get value immediately. No Docker, no Helm, no vector store.
2. **Mid-size engineering team** — wants git-native memory with no extra infra, maybe 10–50 repos.
3. **Platform engineering team** (e.g. Novo Nordisk scale: 5,000+ engineers, 100+ teams) — wants self-hosted Helm deployment, Qdrant or pgvector, air-gapped operation, cosign-verified images, AKS ARM node support.

**All three must work. Never sacrifice tier 0 simplicity for tier 2 power.**

---

## Open source positioning

- All existing serious competitors are commercial SaaS: CodeRabbit, Qodo, Greptile, Augment
- mergelore is the only open-source, self-hostable, Helm-deployable institutional memory layer
- This is the wedge for regulated industries (pharma, finance, healthcare) where SaaS is a hard no
- Publish under MIT licence
- Scope: `automationpi` GitHub organisation

---

## Slash commands available in this project

- `/recall` — query repo history for the current working context
- `/recall-index` — manually trigger re-indexing of recent PRs

---

## Key metrics to track post-launch

- GitHub Actions Marketplace stars
- Docker Hub pulls (mergelore/indexer is the proxy metric for serious adoption)
- `block-on-critical` adoption rate (indicates trust level in the tool)
- Human override rate per repo (high override = low signal quality, needs tuning)
