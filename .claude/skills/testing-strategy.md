# Testing Strategy for mergelore

## Unit tests

- Location: `action/tests/unit/`
- Runner: vitest
- Run with: `npm test`
- Mock all external dependencies (@actions/core, @actions/github, SDKs)
- Every provider gets a unit test file

## Integration tests

- Location: `action/tests/integration/`
- Runner: vitest with `vitest.integration.config.ts`
- Run with: `npm run test:integration`
- Use real API keys from environment variables
- Skip gracefully when keys are absent: `if (!process.env.ANTHROPIC_API_KEY) return`
- Timeout: 30 seconds per test

## What to test

### LLM providers
- Verify structured output parsing (tool_use / json_schema)
- Verify every Finding has a confidence score
- Verify error handling returns empty array
- Verify confidence clamping (0-1 range)

### Memory providers
- Verify relevance scoring logic
- Verify sorting by relevance descending
- Verify filtering (no overlap = excluded)
- Verify statelessness (no shared state between calls)

### Comment formatting
- Verify locked PR comment format exactly
- Verify conflicts vs informational sectioning
- Verify degraded comment format
- Verify no-duplicate behavior (update existing)

### Config parsing
- Verify defaults
- Verify validation errors are actionable
- Verify type conversions

## Image size check

Before every release, verify:
```bash
docker build -t mergelore/action action/
docker images mergelore/action --format '{{.Size}}'
# Must be under 50MB
```
