import { describe, it, expect } from "vitest";
import { NoneMemoryProvider } from "../../../../src/providers/memory/none.js";
import type { Diff, MergedPR } from "../../../../src/types.js";

const makeDiff = (): Diff => ({
  base: "main",
  head: "feature/test",
  files: [],
  totalAdditions: 0,
  totalDeletions: 0,
});

const makeMergedPR = (): MergedPR => ({
  number: 1,
  title: "Test PR",
  body: "Test body",
  url: "https://github.com/test/repo/pull/1",
  mergedAt: "2026-01-01",
  author: "test",
  files: [],
  reviewComments: [],
  labels: [],
});

describe("NoneMemoryProvider", () => {
  it("has the correct name", () => {
    const provider = new NoneMemoryProvider();
    expect(provider.name).toBe("none");
  });

  it("query returns empty array", async () => {
    const provider = new NoneMemoryProvider();
    const result = await provider.query(makeDiff());
    expect(result).toEqual([]);
  });

  it("index resolves without error", async () => {
    const provider = new NoneMemoryProvider();
    await expect(provider.index(makeMergedPR())).resolves.toBeUndefined();
  });
});
