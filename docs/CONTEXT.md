# mergelore — Context, Inspiration, and Design Decisions

This document is the origin story. Read it when you need to understand *why* a
decision was made, not just *what* to build. It contains the reasoning that led
to this architecture and prevents Claude Code from second-guessing it.

---

## The problem we observed

In late 2025 and 2026, a specific failure pattern emerged across engineering teams:

1. AI coding tools (Claude Code, Copilot, Cursor, Codex) started opening PRs
   autonomously at a rate humans could not review
2. AI-generated code was re-introducing patterns that teams had deliberately
   removed — not because AI was buggy, but because AI had no memory of *why*
   those patterns were removed
3. Review queues grew by 91% while PR volume grew by 98% — a structural gap
4. 17% of PRs contained high-severity issues that passed manual review under
   time pressure

The signal that confirmed the problem: Cursor acquired Graphite for $290M in
December 2025, explicitly because review had become the next constraint after
code generation speed. The market confirmed what we observed.

---

## Why existing tools don't solve this

Every tool we researched reviews the *present*:

- **CodeRabbit**: Hunk-level diff analysis. Excellent at what's in the PR.
  Zero historical awareness.
- **GitHub Copilot Review**: Added memory across sessions (Jan 2026), but only
  within a short context window. No cross-PR episodic reasoning.
- **Qodo**: Cross-repo context. Still no episodic memory — knows *what* the
  code is, not the *history of decisions* around it.
- **Greptile**: Indexes the codebase for structural context. Same gap.
- **Decision Guardian**: Closest existing tool. File-pattern → ADR linking.
  Requires *manual upkeep* of markdown decision rules. mergelore builds the
  knowledge base automatically from merged PR history.

The academic term for the gap is **"Decision Shadow"** (from the Lore paper,
arXiv:2603.15566, March 2026): each commit captures a code diff but discards
the reasoning — constraints, rejected alternatives, forward-looking context.

mergelore is the practical CI implementation of that insight.

---

## Why the name "mergelore"

After extensive research verifying clean availability across:
GitHub, GitHub Marketplace, Docker Hub, npm, PyPI

Names eliminated (all taken or conflicting):
`vigil` (status page tool, 1.8k stars), `driftguard` (3 separate projects),
`repolens` (multiple projects), `gitlore` (Chinese knowledge platform),
`codewitness` (Consensys blockchain project), `prchive` (media scraper),
`sentinel` (multiple tools), `scribe` (docs tools), `pr-recall` (too generic)

**mergelore** was chosen because:
- `merge` = the critical gate every AI PR passes through
- `lore` = accumulated wisdom, institutional knowledge, decisions over time
- Reads naturally as a verb: "mergelore flagged a pattern reversal"
- Zero collision anywhere — confirmed March 2026

---

## The architecture insight that matters most

The design has **one critical constraint** that must never be violated:

> **The Action (CI runtime) never runs the embedding model.**
> **The indexer never posts PR comments.**

This separation exists because:

1. **Embedding is slow and expensive** — running it in CI adds 30–90 seconds to
   every PR. Developers hate slow CI. A tool that slows CI gets disabled.

2. **Indexing is historical** — it happens after a PR merges, not when one opens.
   These are fundamentally different triggers with different latency requirements.

3. **Embedding model upgrades must not affect CI** — if you want to switch from
   `text-embedding-3-small` to a better model, you upgrade the indexer container
   and re-index. Not a single CI workflow changes.

4. **Separation of concerns enables the plugin architecture** — the Action cares
   only about querying and reasoning. The indexer cares only about writing and
   embedding. They share a contract (the vector store interface), not code.

This is why the architecture diagram shows a hard async boundary. Don't erase it.

---

## The plugin architecture insight

We deliberately chose to design for *graduation*, not configuration:

**Tier 0 (no memory):** User adds 8 lines of YAML and an API key. Gets immediate
value from Claude reviewing their diff. This works on day one with no setup.

**Tier 1 (git-native memory):** User adds `memory-provider: git-native`. No new
infra. mergelore queries the GitHub API for past PRs and sends relevant ones as
context to the LLM. This is the sweet spot for most teams.

**Tier 2 (vector memory):** Platform team deploys the Helm chart with Qdrant.
Now mergelore has semantic search over the full PR history, not just recency-
based retrieval. This is for large repos (500+ PRs, 5000+ engineers).

**The rule:** Never sacrifice tier 0 simplicity to enable tier 2 power.
A first-time user must get value with fewer than 10 lines of YAML.

---

## The human-in-the-loop design

mergelore is explicitly NOT an autonomous blocker. Every finding is a question,
not a judgment. The slash command design reflects this:

- `/mergelore-acknowledge` — "I saw this, I understand, continuing anyway"
- `/mergelore-override [reason]` — "I disagree with this finding, here's why"
- `/mergelore-update-record` — "This PR itself IS the new decision — update the memory"

**Most importantly:** Override decisions are written back to the memory store.
This creates a virtuous loop — human corrections make the memory smarter.
Over time, the confidence calibration improves because it learns what the
team's actual standards are, not just what the code history implies.

---

## Target users — design for all three simultaneously

1. **Solo developer / small team**
   - Motivation: AI is writing their code but they have no reviewers
   - Need: Zero-infra, immediate value, low cognitive overhead
   - Success: Added to workflow in 5 minutes, caught one real regression in first week

2. **Mid-size engineering team (10–100 engineers)**
   - Motivation: Copilot/Claude Code PRs are overwhelming their review queue
   - Need: git-native memory, no new infra, some configurability
   - Success: Review queue stabilised, repeated pattern violations dropped

3. **Platform engineering team (100+ engineers, regulated industry)**
   - Motivation: Can't use SaaS tools (data residency, compliance)
   - Need: Self-hosted, Helm deploy, air-gapped, cosign-verified images, ARM support
   - Success: Deployed on AKS, passed internal security review, SOC2 evidence usable

The Novo Nordisk scale (5,000+ engineers, 100+ teams) is the mental model for
user 3. Platform teams like this run on AKS, use Crossplane, think in GitOps.
They will read the Helm chart before adopting any tool. Make the Helm chart good.

---

## Open source positioning

All serious competitors are commercial SaaS (CodeRabbit, Qodo, Greptile, Augment).
None of them are self-hostable. None of them have a Helm chart.

mergelore's moat is not features — it's **trust through transparency** and
**deployment flexibility**. A regulated industry team will read the source code,
run the container in their own registry, and sign the image themselves.
No SaaS tool can offer that. This is the wedge.

Publish under MIT licence. Never add a "call home" feature. Never add telemetry
without explicit opt-in documented in the README. The tool must be trustworthy
to teams who cannot trust black boxes.

---

## What success looks like at v1.0

- Published to GitHub Marketplace with 500+ stars
- Docker Hub `mergelore/indexer` has 10,000+ pulls (proxy for serious adoption)
- One case study from a regulated industry team using self-hosted Helm deployment
- The `block-on-critical` adoption rate is <20% (indicates advisory trust)
- Human override rate is declining over time per repo (indicates improving signal quality)

---

## Decisions that are NOT up for debate during v0.1.0

These were settled in the design phase. Do not revisit them in v0.1.0:

- The two interface contracts (`LLMProvider`, `MemoryProvider`)
- The async boundary between Action and indexer
- The three-tier graduation model
- The PR comment format (including slash commands)
- MIT licence
- `mergelore` as the name across all registries
- `automationpi` as the GitHub organisation
- GHCR as primary image registry, Docker Hub as discovery registry
- Multi-arch builds (amd64 + arm64)
