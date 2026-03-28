import { describe, it, expect, vi } from "vitest";
import { GitNativeMemoryProvider } from "../../../../src/providers/memory/git-native.js";
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

function makeMockOctokit(pulls: any[], filesMap: Record<number, string[]>) {
  return {
    rest: {
      pulls: {
        list: vi.fn().mockResolvedValue({ data: pulls }),
        listFiles: vi.fn().mockImplementation(({ pull_number }: { pull_number: number }) => {
          const files = filesMap[pull_number] ?? [];
          return Promise.resolve({
            data: files.map((f: string) => ({ filename: f })),
          });
        }),
      },
    },
  } as any;
}

describe("GitNativeMemoryProvider", () => {
  it("has the correct name", () => {
    const provider = new GitNativeMemoryProvider({
      octokit: makeMockOctokit([], {}),
      owner: "test",
      repo: "repo",
      historyDepth: 20,
    });
    expect(provider.name).toBe("git-native");
  });

  it("returns contexts sorted by relevance descending", async () => {
    const pulls = [
      {
        number: 10,
        title: "PR 10",
        html_url: "https://github.com/test/repo/pull/10",
        merged_at: "2026-01-10",
        body: "Changed auth",
        user: { login: "alice" },
      },
      {
        number: 11,
        title: "PR 11",
        html_url: "https://github.com/test/repo/pull/11",
        merged_at: "2026-01-11",
        body: "Changed config and auth",
        user: { login: "bob" },
      },
    ];

    const filesMap = {
      10: ["src/auth.ts"],
      11: ["src/auth.ts", "src/config.ts"],
    };

    const octokit = makeMockOctokit(pulls, filesMap);
    const provider = new GitNativeMemoryProvider({
      octokit,
      owner: "test",
      repo: "repo",
      historyDepth: 20,
    });

    const diff = makeDiff(["src/auth.ts", "src/config.ts"]);
    const results = await provider.query(diff);

    expect(results).toHaveLength(2);
    // PR 11 has 2/2 overlap = 1.0, PR 10 has 1/2 overlap = 0.5
    expect(results[0].prNumber).toBe(11);
    expect(results[0].relevanceScore).toBe(1.0);
    expect(results[1].prNumber).toBe(10);
    expect(results[1].relevanceScore).toBe(0.5);
  });

  it("filters out PRs with no file overlap", async () => {
    const pulls = [
      {
        number: 20,
        title: "Unrelated PR",
        html_url: "https://github.com/test/repo/pull/20",
        merged_at: "2026-01-20",
        body: "Unrelated change",
        user: { login: "carol" },
      },
    ];

    const filesMap = {
      20: ["src/unrelated.ts"],
    };

    const octokit = makeMockOctokit(pulls, filesMap);
    const provider = new GitNativeMemoryProvider({
      octokit,
      owner: "test",
      repo: "repo",
      historyDepth: 20,
    });

    const diff = makeDiff(["src/auth.ts"]);
    const results = await provider.query(diff);

    expect(results).toEqual([]);
  });

  it("filters out non-merged PRs", async () => {
    const pulls = [
      {
        number: 30,
        title: "Closed but not merged",
        html_url: "https://github.com/test/repo/pull/30",
        merged_at: null,
        body: "Was closed",
        user: { login: "dave" },
      },
    ];

    const octokit = makeMockOctokit(pulls, {});
    const provider = new GitNativeMemoryProvider({
      octokit,
      owner: "test",
      repo: "repo",
      historyDepth: 20,
    });

    const diff = makeDiff(["src/auth.ts"]);
    const results = await provider.query(diff);

    expect(results).toEqual([]);
    // listFiles should never be called for non-merged PRs
    expect(octokit.rest.pulls.listFiles).not.toHaveBeenCalled();
  });

  it("limits results to top 10", async () => {
    const pulls = Array.from({ length: 15 }, (_, i) => ({
      number: i + 1,
      title: `PR ${i + 1}`,
      html_url: `https://github.com/test/repo/pull/${i + 1}`,
      merged_at: `2026-01-${String(i + 1).padStart(2, "0")}`,
      body: `PR body ${i + 1}`,
      user: { login: "user" },
    }));

    const filesMap: Record<number, string[]> = {};
    for (let i = 1; i <= 15; i++) {
      filesMap[i] = ["src/shared.ts"];
    }

    const octokit = makeMockOctokit(pulls, filesMap);
    const provider = new GitNativeMemoryProvider({
      octokit,
      owner: "test",
      repo: "repo",
      historyDepth: 20,
    });

    const diff = makeDiff(["src/shared.ts"]);
    const results = await provider.query(diff);

    expect(results).toHaveLength(10);
  });

  it("index is a no-op", async () => {
    const provider = new GitNativeMemoryProvider({
      octokit: makeMockOctokit([], {}),
      owner: "test",
      repo: "repo",
      historyDepth: 20,
    });

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
});
