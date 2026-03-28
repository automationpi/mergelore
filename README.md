# mergelore

**Give your PRs the institutional memory that AI-generated code lacks.**

mergelore is a GitHub Action that reviews pull requests against your team's history. When a PR re-introduces a pattern you already removed, reverses an architectural decision, or violates a constraint that was load-tested and hardcoded — mergelore flags it before it ships.

## The problem

AI coding tools (Claude Code, Copilot, Cursor, Codex) generate code that looks correct in isolation. But they have zero awareness of your team's history — the decisions made in past PRs, the patterns deliberately removed, the limits that were hardcoded for a reason.

Every existing review tool analyzes the **present diff**. None of them remember *why* past decisions were made.

mergelore bridges that gap.

## How it works

```
PR opened
  |
  v
Extract diff from the PR
  |
  v
Query past merged PRs for relevant decisions (memory provider)
  |
  v
Send diff + historical context to an LLM for analysis (LLM provider)
  |
  v
Post findings as a structured PR comment with confidence scores
```

mergelore runs entirely in your CI pipeline. No data leaves your GitHub Actions runner except API calls to the LLM provider you choose.

### What a mergelore comment looks like

When mergelore finds something, it posts a comment like this:

```markdown
## mergelore findings

> Reviewed 12 past PRs · 3 relevant decisions found · confidence threshold 0.7

### ⚠️ Potential conflicts

**Pattern reversal: legacy auth middleware** · confidence: 0.88
> This PR re-introduces the session-based auth middleware that was removed in PR #42
> due to compliance requirements around token storage. The new code uses the same
> session pattern that legal flagged.
> Source: PR #42 · 2026-01-15

`/mergelore-acknowledge` · `/mergelore-override [reason]` · `/mergelore-update-record`
```

Findings are **suggestions, not blocks** — unless you explicitly opt into `block-on-critical`.

## Quickstart

Add this to `.github/workflows/mergelore.yml`:

```yaml
name: mergelore
on:
  pull_request:
    types: [opened, synchronize, reopened]
  issue_comment:
    types: [created]

permissions:
  pull-requests: write
  contents: read

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: automationpi/mergelore@v0.1.0
        with:
          anthropic-api-key: ${{ secrets.ANTHROPIC_API_KEY }}
```

That's it. Eight lines of YAML and an API key.

## Configuration

| Input | Default | Description |
|-------|---------|-------------|
| `anthropic-api-key` | — | Anthropic API key (required for `claude` provider) |
| `openai-api-key` | — | OpenAI API key (required for `openai` provider) |
| `llm-provider` | `claude` | LLM to use for analysis: `claude` or `openai` |
| `memory-provider` | `git-native` | How to retrieve past decisions: `none` or `git-native` |
| `history-depth` | `20` | Number of past merged PRs to search |
| `confidence-threshold` | `0.7` | Minimum confidence (0.0-1.0) to post a finding |
| `block-on-critical` | `false` | Fail CI on critical findings |
| `timeout` | `45000` | Timeout in ms for LLM and memory queries |

### Using OpenAI instead of Claude

```yaml
- uses: automationpi/mergelore@v0.1.0
  with:
    llm-provider: openai
    openai-api-key: ${{ secrets.OPENAI_API_KEY }}
```

### Diff-only mode (no history)

If you just want LLM-powered diff review without historical context:

```yaml
- uses: automationpi/mergelore@v0.1.0
  with:
    anthropic-api-key: ${{ secrets.ANTHROPIC_API_KEY }}
    memory-provider: none
```

### Blocking on critical findings

```yaml
- uses: automationpi/mergelore@v0.1.0
  with:
    anthropic-api-key: ${{ secrets.ANTHROPIC_API_KEY }}
    block-on-critical: true
```

## Memory providers

mergelore has a plugin architecture. You pick how it remembers your team's decisions.

### `none` — No memory (Tier 0)

The LLM reviews the diff on its own merits. No historical context. Good for trying mergelore out or small repos where past decisions are few.

### `git-native` — GitHub API (Tier 1, default)

Fetches your repo's recently merged PRs via the GitHub API. Scores them by file overlap with the current diff and sends the most relevant ones as context to the LLM. No extra infrastructure needed — it uses the `GITHUB_TOKEN` already available in Actions.

This is the sweet spot for most teams.

### `qdrant` — Vector search (Tier 2, coming in v0.2.0)

Semantic search over your full PR history using vector embeddings. For large repos with hundreds of PRs where recency-based retrieval isn't enough. Requires a Qdrant instance (self-hosted or managed).

## Human-in-the-loop

mergelore is an advisory tool, not an autonomous blocker. Every finding comes with slash commands:

| Command | What it does |
|---------|-------------|
| `/mergelore-acknowledge` | "I saw this, I understand, continuing anyway" |
| `/mergelore-override [reason]` | "I disagree — here's why" (reason is stored as a decision record) |
| `/mergelore-update-record` | "This PR IS the new decision — update the memory after merge" |

**Override decisions are written back as data.** When someone overrides a finding with a reason, that reason becomes part of the institutional memory. Over time, mergelore learns what your team's actual standards are.

## Architecture

```
action/
  src/
    index.ts                    # Main runner — thin orchestrator
    types.ts                    # Shared types (Diff, Context, Finding)
    diff.ts                     # PR diff extraction via GitHub API
    comment.ts                  # PR comment formatter (locked format)
    config.ts                   # Action input parser + validation
    logger.ts                   # Structured JSON logging
    handlers/
      slash-commands.ts         # HITL command handler
    providers/
      llm/
        prompts.ts              # Shared prompts + Finding schema
        claude.ts               # Anthropic API (structured via tool_use)
        openai.ts               # OpenAI API (structured via json_schema)
        factory.ts              # Provider factory
      memory/
        none.ts                 # Tier 0: no memory
        git-native.ts           # Tier 1: GitHub API
        factory.ts              # Provider factory
```

### Plugin interfaces

Everything plugs into two interfaces:

```typescript
interface LLMProvider {
  analyze(diff: Diff, context: Context[]): Promise<Finding[]>
}

interface MemoryProvider {
  index(pr: MergedPR): Promise<void>
  query(diff: Diff): Promise<Context[]>
}
```

Adding a new LLM or memory provider means implementing one interface and adding a case to the factory. That's it.

### Design principles

- **All LLM calls use structured output.** No free text parsing. Claude uses `tool_use`, OpenAI uses `json_schema`.
- **Confidence scores are mandatory.** Every finding has a score between 0.0 and 1.0. Below the threshold, it doesn't get posted.
- **Providers are stateless.** No singleton state, no class-level caching. Every invocation is independent.
- **Graceful degradation everywhere.** If the LLM API is down, mergelore posts a warning — it never breaks your CI.
- **Findings are suggestions.** mergelore never blocks a PR unless you explicitly set `block-on-critical: true`.

## Development

```bash
cd action
npm install
npm run typecheck    # TypeScript strict mode
npm test             # 41 unit tests
npm run build        # esbuild single-file bundle → dist/index.js
```

### Running tests

```bash
npm test                    # unit tests only
npm run test:integration    # integration tests (needs API keys)
```

### Docker

```bash
docker build -t mergelore/action action/
docker images mergelore/action --format '{{.Size}}'  # target: <50MB
```

## Roadmap

| Version | What ships |
|---------|-----------|
| **v0.1.0** | Core action, Claude + OpenAI providers, git-native memory, HITL slash commands |
| v0.2.0 | Qdrant memory provider, async indexer service, cosign image signing |
| v0.3.0 | Helm chart, webhook receiver, pgvector support |

## License

MIT
