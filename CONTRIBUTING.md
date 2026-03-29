# Contributing to mergelore

Thanks for your interest in contributing to mergelore. This guide covers how to get started.

## Getting started

```bash
git clone https://github.com/automationpi/mergelore.git
cd mergelore
```

### Action (TypeScript)

```bash
cd action
npm install
npm run typecheck
npm test
npm run build
```

### Indexer (Python)

```bash
cd indexer
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
ruff check src/ tests/
pytest tests/ -v
```

## How to contribute

### Reporting bugs

Open an issue with:
- What you expected to happen
- What actually happened
- Steps to reproduce
- mergelore version and memory provider used

### Suggesting features

Open an issue describing the use case, not just the feature. Context helps us understand if it fits the project's direction.

### Submitting code

1. Fork the repo
2. Create a branch from `main`
3. Make your changes
4. Ensure all tests pass (`npm test` for action, `pytest` for indexer)
5. Ensure lint passes (`npm run typecheck` for action, `ruff check` for indexer)
6. Open a PR against `main`

### Adding a new LLM provider

1. Create `action/src/providers/llm/{name}.ts`
2. Implement the `LLMProvider` interface
3. Use structured output (tool_use or json_schema) - never parse free text
4. Add to the factory in `action/src/providers/llm/factory.ts`
5. Add unit tests in `action/tests/unit/providers/llm/{name}.test.ts`

### Adding a new memory provider

1. Create `action/src/providers/memory/{name}.ts`
2. Implement the `MemoryProvider` interface
3. `query()` must return `Context[]` sorted by relevance descending
4. Providers must be stateless
5. Add to the factory in `action/src/providers/memory/factory.ts`
6. Add unit tests

### Adding a new embedding provider

1. Create `indexer/src/mergelore_indexer/embed/{name}.py`
2. Implement the `EmbeddingProvider` protocol
3. Add to the factory in `indexer/src/mergelore_indexer/embed/factory.py`
4. Add tests

## Code style

- **TypeScript**: strict mode, no `any` unless unavoidable
- **Python**: ruff for linting, type hints encouraged
- **Commits**: conventional commit messages (`feat:`, `fix:`, `docs:`, `ci:`)
- **Tests**: every provider gets unit tests, integration tests are optional but welcome

## Architecture rules

These are non-negotiable:

1. The action never runs embedding models
2. The indexer never posts PR comments
3. All LLM calls use structured output
4. Confidence scores are mandatory on every finding
5. Providers are stateless
6. Findings are suggestions, never hard blocks (unless `block-on-critical` is set)

## License

By contributing, you agree that your contributions will be licensed under MIT.
