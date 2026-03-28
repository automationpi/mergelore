# mergelore — Requirements

## Functional requirements

### FR-01: Core Action — diff review

- **FR-01.1** The Action MUST trigger on `pull_request` events: `opened`, `synchronize`, `reopened`
- **FR-01.2** The Action MUST extract a full unified diff between the PR branch and base branch
- **FR-01.3** The Action MUST support a `none` memory provider that reviews the diff with LLM only, requiring only an API key
- **FR-01.4** The Action MUST post findings as a structured comment on the PR using the GitHub REST API
- **FR-01.5** The Action MUST NOT post duplicate comments on re-runs — update the existing comment if one exists
- **FR-01.6** The Action MUST surface a confidence score (0.0–1.0) on every Finding before posting
- **FR-01.7** The Action MUST support `block-on-critical: true` to fail CI when critical findings exist (default: false)

### FR-02: LLM provider interface

- **FR-02.1** The system MUST implement a `LLMProvider` interface: `analyze(diff: Diff, context: Context[]): Promise<Finding[]>`
- **FR-02.2** The system MUST ship a `claude` provider using the Anthropic API (claude-sonnet-4-5 or later) as the default
- **FR-02.3** The system MUST ship an `openai` provider using the OpenAI API (gpt-4o) as an alternative
- **FR-02.4** All LLM calls MUST use structured output / JSON schema — never parse free text
- **FR-02.5** LLM provider MUST be selectable via the `llm-provider` action input
- **FR-02.6** The provider factory MUST throw a clear error if an unknown provider name is supplied

### FR-03: Memory provider interface

- **FR-03.1** The system MUST implement a `MemoryProvider` interface: `index(pr: MergedPR): Promise<void>` and `query(diff: Diff): Promise<Context[]>`
- **FR-03.2** The system MUST ship a `none` provider (returns empty context, no-op index)
- **FR-03.3** The system MUST ship a `git-native` provider that fetches merged PRs via the GitHub API
- **FR-03.4** The `git-native` provider MUST respect the `history-depth` input (default: 20)
- **FR-03.5** The system MUST ship a `qdrant` provider for semantic vector search
- **FR-03.6** The `qdrant` provider MUST be configurable via `vector-store-url` and `QDRANT_API_KEY` environment variable
- **FR-03.7** Memory providers MUST be stateless — no singleton or shared state between invocations
- **FR-03.8** `query()` MUST return `Context[]` sorted by relevance score descending

### FR-04: Indexer service

- **FR-04.1** The indexer MUST run independently of the GitHub Actions CI runner
- **FR-04.2** The indexer MUST trigger on `push` to the default branch (merged PR proxy) or via webhook
- **FR-04.3** The indexer MUST extract: PR title, body, review comments, inline discussion threads, linked issues, files touched, author, merge date
- **FR-04.4** The indexer MUST support pluggable embedding models via environment variable `MERGELORE_EMBED_MODEL`
- **FR-04.5** Supported embedding models: `text-embedding-3-small` (OpenAI), `nomic-embed-text` (local), `embed-english-v3.0` (Cohere)
- **FR-04.6** The indexer MUST chunk content at 512 tokens with 64-token overlap
- **FR-04.7** The indexer MUST NOT post PR comments or call the GitHub PR API
- **FR-04.8** The indexer MUST write provenance metadata with every embedding: `{pr_number, pr_url, merged_at, files_touched[], author}`

### FR-05: Human-in-the-loop (HITL)

- **FR-05.1** mergelore MUST support the slash command `/mergelore-acknowledge` to dismiss a flag
- **FR-05.2** mergelore MUST support `/mergelore-override [reason]` to override with a reason
- **FR-05.3** mergelore MUST support `/mergelore-update-record` to trigger re-indexing of the current PR after merge
- **FR-05.4** Override decisions MUST be written back to the memory store as new records with the override reason
- **FR-05.5** Slash commands MUST be processed via the `issue_comment` GitHub Actions trigger

### FR-06: Docker images

- **FR-06.1** The project MUST ship three Docker images: `mergelore/action`, `mergelore/indexer`, `mergelore/webhook`
- **FR-06.2** `mergelore/action` MUST be based on `node:20-alpine` and target < 50MB
- **FR-06.3** `mergelore/indexer` MUST be based on `python:3.12-slim`
- **FR-06.4** `mergelore/webhook` MUST be based on `scratch` (Go static binary)
- **FR-06.5** All images MUST be built for `linux/amd64` AND `linux/arm64`
- **FR-06.6** All images MUST be signed with cosign keyless signing on every release
- **FR-06.7** All images MUST pass Trivy critical CVE scan before publishing
- **FR-06.8** Images MUST be published to both Docker Hub (`mergelore/`) and GHCR (`ghcr.io/automationpi/`)

### FR-07: Helm chart

- **FR-07.1** The Helm chart MUST deploy all three components: action sidecar, indexer, optional webhook receiver
- **FR-07.2** `values.yaml` MUST support a `mode` key: `minimal` (action only) | `standard` (action + indexer) | `full` (all three + qdrant)
- **FR-07.3** The chart MUST support `image.repository` override to switch between GHCR and Docker Hub
- **FR-07.4** The chart MUST NOT require cluster-admin privileges — namespace-scoped RBAC only
- **FR-07.5** The chart MUST support existing pgvector/Qdrant instances via `externalVectorStore` values

### FR-08: Claude Code integration

- **FR-08.1** The project MUST ship a `CLAUDE.md` at the root with full project context
- **FR-08.2** The project MUST ship a `recall-check` sub-agent in `.claude/agents/`
- **FR-08.3** The project MUST ship a `/recall` slash command in `.claude/commands/`
- **FR-08.4** The project MUST ship a `/recall-index` slash command in `.claude/commands/`
- **FR-08.5** `.claude/settings.json` MUST include a `PostToolUse` hook on `gh pr create` to attach a recall report
- **FR-08.6** `.claude/settings.json` MUST block direct edits on the `main` branch

---

## Non-functional requirements

### NFR-01: Performance

- **NFR-01.1** Action cold start to first PR comment MUST complete in under 60 seconds on a standard GitHub-hosted runner
- **NFR-01.2** `git-native` memory query MUST complete in under 10 seconds for repos with up to 500 PRs
- **NFR-01.3** Qdrant vector query MUST complete in under 2 seconds for collections with up to 10,000 documents
- **NFR-01.4** `mergelore/action` Docker image MUST be under 50MB uncompressed
- **NFR-01.5** `mergelore/webhook` Docker image MUST be under 10MB uncompressed

### NFR-02: Reliability

- **NFR-02.1** The Action MUST NOT fail CI if the LLM API is unavailable — degrade gracefully with a warning comment
- **NFR-02.2** The Action MUST NOT fail CI if the vector store is unavailable — fall back to `git-native` mode with a warning
- **NFR-02.3** The indexer MUST implement retry with exponential backoff for embedding API calls (max 3 retries)
- **NFR-02.4** The Action MUST implement a configurable timeout (default: 45s) to prevent hanging CI jobs

### NFR-03: Security

- **NFR-03.1** API keys MUST only be accepted via GitHub Actions secrets — never via plaintext inputs
- **NFR-03.2** The Action MUST run with least-privilege permissions: `pull-requests: write`, `contents: read`
- **NFR-03.3** The Action MUST NOT store API keys, diffs, or PR content in GitHub Actions logs
- **NFR-03.4** All Docker images MUST be scanned with Trivy on every build — critical CVEs block publish
- **NFR-03.5** All release images MUST be signed with cosign keyless signing
- **NFR-03.6** The Helm chart MUST default to non-root container execution

### NFR-04: Extensibility

- **NFR-04.1** Adding a new LLM provider MUST require changes only in `action/src/providers/llm/` and `action/src/index.ts`
- **NFR-04.2** Adding a new memory provider MUST require changes only in `action/src/providers/memory/` and `action/src/index.ts`
- **NFR-04.3** The embedding model MUST be swappable via environment variable with zero code changes to the indexer
- **NFR-04.4** The Helm chart MUST support BYO (bring your own) vector store without deploying the bundled Qdrant

### NFR-05: Observability

- **NFR-05.1** The Action MUST emit structured log lines (JSON) for: trigger, context retrieved, findings count, LLM latency, comment posted
- **NFR-05.2** The indexer MUST emit metrics: documents indexed, embedding latency p50/p95, errors
- **NFR-05.3** The Helm chart MUST include Prometheus ServiceMonitor definitions (optional, off by default)

### NFR-06: Developer experience

- **NFR-06.1** A first-time user MUST be able to add mergelore to a repo with fewer than 10 lines of YAML
- **NFR-06.2** All error messages MUST be actionable — include what failed, why, and how to fix it
- **NFR-06.3** The README MUST include a working quickstart that can be copy-pasted verbatim
- **NFR-06.4** Every provider MUST have its own section in `docs/PROVIDERS.md` with configuration examples

---

## MVP definition — what ships in v0.1.0

The minimum version that proves the concept and is publishable to GitHub Marketplace:

| Component | In v0.1.0 | Notes |
|-----------|-----------|-------|
| `none` memory provider | ✅ | Diff-only Claude review |
| `git-native` memory provider | ✅ | Core differentiator |
| `claude` LLM provider | ✅ | Default |
| `openai` LLM provider | ✅ | Easy second provider |
| PR comment posting | ✅ | Structured format |
| HITL slash commands | ✅ | Acknowledge + override |
| `action.yml` | ✅ | Publishable to Marketplace |
| `mergelore/action` Docker image | ✅ | Multi-arch, signed |
| CLAUDE.md | ✅ | Ships with the repo |
| `recall-check` sub-agent | ✅ | Claude Code integration |
| `qdrant` memory provider | ❌ | v0.2.0 |
| `mergelore/indexer` Docker image | ❌ | v0.2.0 |
| Helm chart | ❌ | v0.3.0 |
| `mergelore/webhook` image | ❌ | v0.3.0 |
| Cosign signing | ❌ | v0.2.0 |

---

## Out of scope (forever)

- mergelore will NOT store PR content on any third-party server (all processing in-runner or self-hosted)
- mergelore will NOT send telemetry without explicit opt-in
- mergelore will NOT require a paid subscription — open source MIT, always
- mergelore will NOT auto-merge or auto-fix PRs — it is an advisory tool only
