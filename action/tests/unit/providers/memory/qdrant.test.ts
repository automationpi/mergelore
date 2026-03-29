import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@actions/core", () => ({
  info: vi.fn(),
  debug: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
}));

import { QdrantMemoryProvider } from "../../../../src/providers/memory/qdrant.js";
import type { Diff } from "../../../../src/types.js";

function makeDiff(files: string[]): Diff {
  return {
    base: "main",
    head: "feature/test",
    files: files.map((f) => ({
      filename: f,
      status: "modified" as const,
      patch: "",
      additions: 1,
      deletions: 0,
    })),
    totalAdditions: files.length,
    totalDeletions: 0,
  };
}

function makePoint(
  prNumber: number,
  files: string[],
  chunkIndex = 0,
  totalChunks = 1,
) {
  return {
    id: `${prNumber}-${chunkIndex}`,
    payload: {
      pr_number: prNumber,
      pr_title: `PR #${prNumber}`,
      pr_url: `https://github.com/test/repo/pull/${prNumber}`,
      merged_at: `2026-01-${String(prNumber).padStart(2, "0")}`,
      author: "alice",
      files_touched: files,
      chunk_text: `Chunk ${chunkIndex} of PR ${prNumber}`,
      chunk_index: chunkIndex,
      total_chunks: totalChunks,
    },
  };
}

function makeMockOctokit() {
  return {
    rest: {
      pulls: {
        list: vi.fn().mockResolvedValue({ data: [] }),
        listFiles: vi.fn().mockResolvedValue({ data: [] }),
      },
    },
  } as any;
}

function makeProvider(fetchMock?: any) {
  if (fetchMock) {
    vi.stubGlobal("fetch", fetchMock);
  }
  return new QdrantMemoryProvider({
    vectorStoreUrl: "http://qdrant:6333",
    apiKey: "test-key",
    octokit: makeMockOctokit(),
    owner: "test",
    repo: "repo",
    historyDepth: 20,
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("QdrantMemoryProvider", () => {
  it("has the correct name", () => {
    const provider = makeProvider();
    expect(provider.name).toBe("qdrant");
  });

  it("index is a no-op", async () => {
    const provider = makeProvider();
    await expect(
      provider.index({
        number: 1,
        title: "Test",
        body: "",
        url: "",
        mergedAt: "",
        author: "",
        files: [],
        reviewComments: [],
        labels: [],
      }),
    ).resolves.toBeUndefined();
  });

  it("returns contexts sorted by relevance descending", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          result: {
            points: [
              makePoint(10, ["src/auth.ts"]),
              makePoint(11, ["src/auth.ts", "src/config.ts"]),
            ],
          },
        }),
    });

    const provider = makeProvider(fetchMock);
    const results = await provider.query(
      makeDiff(["src/auth.ts", "src/config.ts"]),
    );

    expect(results).toHaveLength(2);
    // PR 11 has 2/2 overlap = 1.0, PR 10 has 1/2 = 0.5
    expect(results[0].prNumber).toBe(11);
    expect(results[0].relevanceScore).toBe(1.0);
    expect(results[1].prNumber).toBe(10);
    expect(results[1].relevanceScore).toBe(0.5);
  });

  it("deduplicates chunks from the same PR", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          result: {
            points: [
              makePoint(5, ["src/auth.ts"], 0, 3),
              makePoint(5, ["src/auth.ts"], 1, 3),
              makePoint(5, ["src/auth.ts"], 2, 3),
            ],
          },
        }),
    });

    const provider = makeProvider(fetchMock);
    const results = await provider.query(makeDiff(["src/auth.ts"]));

    expect(results).toHaveLength(1);
    expect(results[0].prNumber).toBe(5);
  });

  it("returns empty array when no matching documents", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          result: { points: [] },
        }),
    });

    const provider = makeProvider(fetchMock);
    const results = await provider.query(makeDiff(["src/auth.ts"]));

    expect(results).toEqual([]);
  });

  it("falls back to git-native on connection error", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValue(new Error("Connection refused"));

    const provider = makeProvider(fetchMock);
    const results = await provider.query(makeDiff(["src/auth.ts"]));

    // Fallback returns empty since mock octokit has no PRs
    expect(results).toEqual([]);
  });

  it("falls back to git-native on HTTP error", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve("Unauthorized"),
    });

    const provider = makeProvider(fetchMock);
    const results = await provider.query(makeDiff(["src/auth.ts"]));

    expect(results).toEqual([]);
  });

  it("sends api-key header when configured", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ result: { points: [] } }),
    });

    const provider = makeProvider(fetchMock);
    await provider.query(makeDiff(["src/auth.ts"]));

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/points/scroll"),
      expect.objectContaining({
        headers: expect.objectContaining({
          "api-key": "test-key",
        }),
      }),
    );
  });

  it("returns empty for empty diff", async () => {
    const provider = makeProvider();
    const results = await provider.query(makeDiff([]));
    expect(results).toEqual([]);
  });
});
