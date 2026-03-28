# mergelore — Claude Code Kit

This kit contains everything Claude Code needs to build mergelore from scratch.
Drop the contents of this kit into your project root and open Claude Code.

## What's in this kit

```
CLAUDE.md                          ← Primary project memory — Claude reads this first
docs/
  REQUIREMENTS.md                  ← Full functional + non-functional requirements
  CONTEXT.md                       ← Origin story, design decisions, inspiration
.claude/
  agents/
    recall-check.md                ← Sub-agent: queries repo history before PRs
  commands/
    recall.md                      ← /recall slash command
    recall-index.md                ← /recall-index slash command
  hooks/
    pre-pr-check.js                ← Fires before gh pr create
    post-pr-attach.js              ← Attaches recall report after PR created
  skills/
    provider-pattern.md            ← How to implement LLMProvider / MemoryProvider
    testing-strategy.md            ← Test patterns, vitest setup, image size check
  settings.json                    ← Hooks config, permissions, branch protection
```

## How to use this kit

### 1. Set up the repo

```bash
# Create the mergelore repo
gh repo create automationpi/mergelore --public --clone
cd mergelore

# Copy this kit into the repo
cp -r /path/to/mergelore-claude-kit/. .

# Open Claude Code
claude
```

### 2. First prompt to Claude Code

```
Read CLAUDE.md, docs/REQUIREMENTS.md, and docs/CONTEXT.md.
Then scaffold the repository structure defined in CLAUDE.md,
starting with the TypeScript action and the two provider interfaces.
Begin with FR-01 and FR-02 from REQUIREMENTS.md.
Run /recall before creating any PR.
```

### 3. Build order (recommended)

Claude Code should build in this order:

1. `action/src/types.ts` — shared types (Diff, Context, Finding, MergedPR)
2. `action/src/providers/llm/interface.ts` + `claude.ts`
3. `action/src/providers/memory/interface.ts` + `none.ts` + `git-native.ts`
4. `action/src/diff.ts` — git diff extraction
5. `action/src/comment.ts` — PR comment formatter
6. `action/src/index.ts` — main runner + provider factory
7. `action/action.yml` — action manifest
8. `action/tests/` — unit + integration tests
9. `indexer/` — Python embedding service
10. `helm/` — Helm chart

### 4. Environment variables needed

```bash
# For Claude provider (default)
export ANTHROPIC_API_KEY=sk-ant-...

# For GitHub API access
export GITHUB_TOKEN=ghp_...

# For integration tests (optional)
export OPENAI_API_KEY=sk-...

# For vector store (optional, tier 2 only)
export RECALL_STORE_URL=http://localhost:6333
export QDRANT_API_KEY=...
```

## Key rules Claude Code must follow

From `CLAUDE.md` — these are non-negotiable:

1. The Action NEVER runs the embedding model
2. The indexer NEVER posts PR comments
3. All LLM calls use structured output — never parse free text
4. Confidence scores are mandatory on every Finding
5. Human overrides are data — write them back to the memory store
6. `block-on-critical` is opt-in only — default is comment-only
7. Providers are stateless — no singleton state
8. The two interfaces are sacred — LLMProvider and MemoryProvider
9. Tests are not optional — every provider gets an integration test
10. Image size matters — mergelore/action must stay under 50MB

## MVP checklist (v0.1.0)

- [ ] `none` memory provider working
- [ ] `git-native` memory provider working
- [ ] `claude` LLM provider with structured output
- [ ] `openai` LLM provider
- [ ] PR comment in the correct format
- [ ] HITL slash commands (acknowledge, override)
- [ ] `action.yml` published to GitHub Marketplace
- [ ] `mergelore/action` Docker image, multi-arch, signed
- [ ] Unit tests passing
- [ ] Integration tests passing with real keys
- [ ] README with working quickstart

## Useful commands once in Claude Code

```bash
/recall                    # Query repo history before making changes
/recall-index              # Manually trigger re-indexing
/recall src/providers/     # Query history for a specific path
```

## Registry handles (all confirmed clean, March 2026)

| Registry | Handle |
|----------|--------|
| GitHub | `github.com/automationpi/mergelore` |
| GitHub Marketplace | `marketplace/actions/mergelore` |
| GHCR | `ghcr.io/automationpi/mergelore-*` |
| Docker Hub | `hub.docker.com/u/mergelore` |
| npm | `@automationpi/mergelore` |
| PyPI | `mergelore` |
