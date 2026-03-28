# mergelore v0.1.0 MVP — Implementation Plan

## Context

mergelore is a GitHub Action that gives PRs "institutional memory" — surfacing past architectural decisions that AI-generated code silently re-introduces. The repo currently has only documentation (CLAUDE.md, REQUIREMENTS.md, CONTEXT.md). This plan covers building the full v0.1.0 MVP from scratch.

## Scope: What ships in v0.1.0

- [x] Plan written and approved
- [x] `none` + `git-native` memory providers
- [x] `claude` + `openai` LLM providers
- [x] PR comment posting (locked format, no duplicates)
- [x] HITL slash commands (acknowledge, override)
- [x] `action.yml` for GitHub Marketplace
- [x] Docker image (Node 20 Alpine, <50MB, multi-arch)
- [x] Unit + integration tests (41 passing)
- [x] `.claude/` configuration (agents, commands, hooks)
- [x] CI/CD workflows

**NOT in v0.1.0:** qdrant provider, indexer, Helm chart, webhook, cosign signing.

---

## Build Phases

### Phase 1: Scaffolding
- [ ] `action/package.json`
- [ ] `action/tsconfig.json`
- [ ] `action/vitest.config.ts`
- [ ] `npm install` successful

**Runtime deps:** `@actions/core`, `@actions/github`, `@anthropic-ai/sdk`, `openai`
**Dev deps:** `typescript`, `vitest`, `esbuild`, `@types/node`
**Build script:** `esbuild src/index.ts --bundle --platform=node --target=node20 --outfile=dist/index.js`
**Target:** ES2022, strict mode, Node16 module resolution

---

### Phase 2: Types (`action/src/types.ts`)
- [ ] `Diff` / `DiffFile` — unified diff representation
- [ ] `Context` — past decision with `relevanceScore` (0-1, computed by memory provider)
- [ ] `Finding` — LLM result with `confidence` (0-1, mandatory), `severity`, `explanation`
- [ ] `MergedPR` — metadata for indexing
- [ ] `ActionConfig` — parsed action inputs
- [ ] `LogEvent` — structured log entry

**Key decision:** Two separate scores — `Context.relevanceScore` (from memory provider) vs `Finding.confidence` (from LLM). Never conflated.

---

### Phase 3: LLM Providers (parallel with Phase 4-5)
- [ ] `action/src/providers/llm/interface.ts` — `LLMProvider { analyze(diff, context): Promise<Finding[]> }`
- [ ] `action/src/providers/llm/prompts.ts` — shared prompt builder + Finding JSON schema
- [ ] `action/src/providers/llm/claude.ts` — Anthropic SDK with `tool_use` structured output
- [ ] `action/src/providers/llm/openai.ts` — OpenAI SDK with `response_format: json_schema`
- [ ] `action/src/providers/llm/factory.ts` — provider factory with actionable errors

**Design:**
- Both providers share prompts from `prompts.ts` (prevents drift)
- Stateless — constructor takes API key only
- On API failure, return empty `Finding[]` (caller handles degradation)
- Claude model: `claude-sonnet-4-5-20250514`
- OpenAI model: `gpt-4o`

---

### Phase 4: Memory Providers (parallel with Phase 3, 5)
- [ ] `action/src/providers/memory/interface.ts` — `MemoryProvider { index(pr), query(diff) }`
- [ ] `action/src/providers/memory/none.ts` — no-op `index()`, empty array `query()`
- [ ] `action/src/providers/memory/git-native.ts` — core differentiator
- [ ] `action/src/providers/memory/factory.ts`

**git-native implementation:**
1. `pulls.list()` with `state: closed`, filtered to merged, limited by `historyDepth`
2. `pulls.listFiles()` per PR (parallelized in batches of 10)
3. Relevance scoring: `filesOverlap.length / diff.files.length` + keyword matching
4. Sort by relevance descending, return top 10
5. `index()` is a no-op (GitHub API is the implicit store)
6. Override data stored as hidden HTML comments on PRs

**Design:** Octokit injected via constructor (stateless, testable).

---

### Phase 5: Diff + Comment + Utilities (parallel with Phase 3-4)
- [ ] `action/src/diff.ts` — `extractDiff()` via Octokit `pulls.listFiles()`
- [ ] `action/src/comment.ts` — `formatComment()` (locked format) + `postOrUpdateComment()`
- [ ] `action/src/config.ts` — parse + validate action inputs from `@actions/core`
- [ ] `action/src/logger.ts` — structured JSON logging wrapping `@actions/core`

**comment.ts details:**
- `postOrUpdateComment()`: find existing comment by `## mergelore findings` marker, update or create (FR-01.5)
- `formatComment()`: split findings into conflicts (warning/critical above threshold) and informational

---

### Phase 6: Main Runner (`action/src/index.ts`)
- [ ] Config parsing
- [ ] Event routing (pull_request vs issue_comment)
- [ ] Provider creation via factories
- [ ] Diff extraction → memory query → LLM analysis pipeline
- [ ] Timeout wrapper (default 45s)
- [ ] Graceful degradation on failures
- [ ] `block-on-critical` gating

**Flow:**
1. Parse config → get GitHub context + Octokit
2. Route: `issue_comment` → slash command handler; `pull_request` → review flow
3. Create providers via factories
4. Extract diff → query memory → LLM analysis (with timeout)
5. Filter findings by confidence threshold
6. Post/update comment
7. If `block-on-critical` + critical findings → `core.setFailed()`

**Graceful degradation:** LLM/memory failures produce warning comment, never fail CI. Top-level catch does NOT call `setFailed()`.

---

### Phase 7: Slash Commands (`action/src/handlers/slash-commands.ts`)
- [ ] `/mergelore-acknowledge` → react with checkmark, mark finding in comment
- [ ] `/mergelore-override [reason]` → react, write override as hidden HTML comment
- [ ] `/mergelore-update-record` → react, add `mergelore:reindex` label

Triggered by `issue_comment` event. Main runner detects event type and routes here.

---

### Phase 8: Action Manifest (`action/action.yml`)
- [ ] `runs.using: node20`, `main: dist/index.js`
- [ ] All inputs per locked schema + optional `openai-api-key`
- [ ] Marketplace metadata (name, description, author, branding)

---

### Phase 9: Tests
- [ ] **Unit: comment.test.ts** — locked format, zero findings, mixed severities
- [ ] **Unit: diff.test.ts** — mock Octokit, DiffFile mapping
- [ ] **Unit: config.test.ts** — defaults, invalid inputs, missing required
- [ ] **Unit: claude.test.ts** — mock SDK, verify structured output parsing
- [ ] **Unit: openai.test.ts** — mock SDK, verify structured output parsing
- [ ] **Unit: none.test.ts** — empty array, no-op
- [ ] **Unit: git-native.test.ts** — mock Octokit, relevance scoring, sorting
- [ ] **Unit: slash-commands.test.ts** — command parsing, flows
- [ ] **Integration: claude** — real diff, verify Finding[] structure
- [ ] **Integration: openai** — real diff, verify Finding[] structure
- [ ] **Integration: git-native** — query real public repo PRs

---

### Phase 10: Docker + CI
- [ ] `action/Dockerfile` — multi-stage (node:20-alpine builder → node:20-alpine + single JS file)
- [ ] `.github/workflows/ci.yml` — typecheck → unit test → build → verify bundle size
- [ ] `.github/workflows/release.yml` — build + multi-arch Docker + push GHCR/Docker Hub
- [ ] `.github/workflows/dogfood.yml` — mergelore reviews its own PRs

**Note:** `action.yml` uses `node20` runner (no Docker for Marketplace). Docker image is for self-hosting.

---

### Phase 11: `.claude/` Configuration
- [ ] `.claude/agents/recall-check.md` — sub-agent for pre-PR history check
- [ ] `.claude/commands/recall.md` + `recall-index.md`
- [ ] `.claude/hooks/pre-pr-check.js` + `post-pr-attach.js`
- [ ] `.claude/settings.json` — hooks config, branch protection on main

---

## Key Design Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Bundle tool | esbuild single-file | No node_modules on runner, fast builds |
| Shared prompts | `prompts.ts` module | Prevents prompt drift between LLM providers |
| Octokit injection | Constructor param | Keeps providers stateless + testable |
| Override storage | Hidden HTML comments on PRs | No external infra needed for git-native v0.1.0 |
| Failure handling | Warning comment, never fail CI | Only `block-on-critical` calls `setFailed()` |
| Two score types | relevanceScore (memory) vs confidence (LLM) | Different sources, different meanings |
| Action runner | `node20` (not Docker) | Standard for Marketplace; Docker image is for self-hosting |

---

## Dependency Graph

```
Phase 1 (scaffold)
  └── Phase 2 (types)
        ├── Phase 3 (LLM providers)  ─┐
        ├── Phase 4 (memory providers) ├── Phase 6 (main runner)
        └── Phase 5 (diff/comment/utils)┘       │
                                          Phase 7 (slash commands)
                                                 │
                                          Phase 8 (action.yml)
                                                 │
                                          Phase 9 (tests)
                                                 │
                                          Phase 10 (Docker + CI)
                                                 │
                                          Phase 11 (.claude/ config)
```

Phases 3, 4, 5 are independent and can be built in parallel.

---

## Verification Checklist

- [ ] `npm run typecheck` — zero errors
- [ ] `npm test` — all unit tests pass
- [ ] `npm run build` — produces `dist/index.js`
- [ ] Bundle size < 1MB
- [ ] Integration tests pass with real API keys
- [ ] Test on a real repo PR via workflow YAML
- [ ] `docker build` + `docker images` → verify < 50MB
