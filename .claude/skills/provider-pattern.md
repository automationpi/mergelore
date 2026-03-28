# Provider Pattern — How to implement providers in mergelore

## LLM Provider

1. Create `action/src/providers/llm/{name}.ts`
2. Implement the `LLMProvider` interface from `types.ts`:
   ```typescript
   interface LLMProvider {
     readonly name: string;
     analyze(diff: Diff, context: Context[]): Promise<Finding[]>;
   }
   ```
3. Use structured output (tool_use for Anthropic, json_schema for OpenAI) — never parse free text
4. Import shared prompts from `prompts.ts` to prevent drift
5. Return empty `Finding[]` on API failure — let the caller handle degradation
6. Constructor takes only the API key — providers must be stateless
7. Add the new provider to `factory.ts` switch statement
8. Add unit test in `tests/unit/providers/llm/{name}.test.ts`
9. Add integration test in `tests/integration/providers/llm/{name}.test.ts`

## Memory Provider

1. Create `action/src/providers/memory/{name}.ts`
2. Implement the `MemoryProvider` interface from `types.ts`:
   ```typescript
   interface MemoryProvider {
     readonly name: string;
     index(pr: MergedPR): Promise<void>;
     query(diff: Diff): Promise<Context[]>;
   }
   ```
3. `query()` must return `Context[]` sorted by relevance score descending
4. Providers must be stateless — no singleton or class-level shared state
5. Accept dependencies (Octokit, config) via constructor injection
6. Add to `factory.ts` switch statement
7. Add unit + integration tests
