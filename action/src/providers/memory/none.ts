import type { Diff, Context, MergedPR, MemoryProvider } from "../../types.js";

export class NoneMemoryProvider implements MemoryProvider {
  readonly name = "none";

  async index(_pr: MergedPR): Promise<void> {
    // No-op: tier 0 has no memory store
  }

  async query(_diff: Diff): Promise<Context[]> {
    return [];
  }
}
