# /recall — Query repo history

Query the repository's merged PR history for decisions relevant to the current working context.

## Usage

```
/recall              # scan all current changes
/recall src/auth/    # scan a specific path
```

## Steps

1. Get the current diff or the specified path
2. Search merged PRs that touched the same files using `gh pr list --state merged`
3. For each relevant PR, fetch its body and review comments
4. Summarize past decisions that may be relevant
5. Flag any potential conflicts with current changes
