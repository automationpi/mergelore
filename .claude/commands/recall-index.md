# /recall-index — Manually trigger re-indexing

Manually trigger re-indexing of recent merged PRs to update the decision memory.

## Usage

```
/recall-index        # re-index last 20 merged PRs
/recall-index 50     # re-index last 50 merged PRs
```

## Steps

1. Parse the depth argument (default: 20)
2. Fetch recent merged PRs via `gh pr list --state merged --limit <depth>`
3. For each PR, extract: title, body, review comments, files touched
4. Report what was indexed and any notable decisions found
