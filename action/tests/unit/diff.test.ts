import { describe, it, expect, vi } from "vitest";
import { extractDiff } from "../../src/diff.js";

function makeMockOctokit(files: any[]) {
  return {
    rest: {
      pulls: {
        listFiles: vi.fn().mockResolvedValue({ data: files }),
      },
    },
  } as any;
}

describe("extractDiff", () => {
  it("maps GitHub API files to DiffFile objects", async () => {
    const octokit = makeMockOctokit([
      {
        filename: "src/auth.ts",
        status: "modified",
        patch: "@@ -1,3 +1,5 @@\n+new line",
        additions: 2,
        deletions: 0,
        previous_filename: undefined,
      },
      {
        filename: "src/old.ts",
        status: "removed",
        patch: "@@ -1,5 +0,0 @@\n-deleted",
        additions: 0,
        deletions: 5,
        previous_filename: undefined,
      },
    ]);

    const diff = await extractDiff(octokit, "owner", "repo", 1, "main", "feature");

    expect(diff.base).toBe("main");
    expect(diff.head).toBe("feature");
    expect(diff.files).toHaveLength(2);
    expect(diff.files[0].filename).toBe("src/auth.ts");
    expect(diff.files[0].status).toBe("modified");
    expect(diff.files[1].status).toBe("removed");
    expect(diff.totalAdditions).toBe(2);
    expect(diff.totalDeletions).toBe(5);
  });

  it("maps renamed files correctly", async () => {
    const octokit = makeMockOctokit([
      {
        filename: "src/new-name.ts",
        status: "renamed",
        patch: "",
        additions: 0,
        deletions: 0,
        previous_filename: "src/old-name.ts",
      },
    ]);

    const diff = await extractDiff(octokit, "owner", "repo", 1, "main", "feature");

    expect(diff.files[0].status).toBe("renamed");
    expect(diff.files[0].previousFilename).toBe("src/old-name.ts");
  });

  it("truncates patches that exceed size limit", async () => {
    const largePatch = "x".repeat(110_000);
    const octokit = makeMockOctokit([
      {
        filename: "src/big.ts",
        status: "modified",
        patch: largePatch,
        additions: 1000,
        deletions: 0,
      },
    ]);

    const diff = await extractDiff(octokit, "owner", "repo", 1, "main", "feature");

    expect(diff.files[0].patch).toContain("truncated");
    expect(diff.files[0].patch.length).toBeLessThan(largePatch.length);
  });

  it("handles files with no patch", async () => {
    const octokit = makeMockOctokit([
      {
        filename: "binary.png",
        status: "added",
        patch: undefined,
        additions: 0,
        deletions: 0,
      },
    ]);

    const diff = await extractDiff(octokit, "owner", "repo", 1, "main", "feature");

    expect(diff.files[0].patch).toBe("");
  });
});
