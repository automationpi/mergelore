import type { GitHub } from "@actions/github/lib/utils.js";
import type { Diff, DiffFile } from "./types.js";

type Octokit = InstanceType<typeof GitHub>;

const MAX_PATCH_BYTES = 100_000; // 100KB total patch limit

export async function extractDiff(
  octokit: Octokit,
  owner: string,
  repo: string,
  pullNumber: number,
  base: string,
  head: string,
): Promise<Diff> {
  const { data: files } = await octokit.rest.pulls.listFiles({
    owner,
    repo,
    pull_number: pullNumber,
    per_page: 100,
  });

  let totalPatchBytes = 0;
  const diffFiles: DiffFile[] = [];

  for (const file of files) {
    const patch = file.patch ?? "";

    // Truncate if cumulative patch size exceeds limit
    if (totalPatchBytes + patch.length > MAX_PATCH_BYTES) {
      diffFiles.push({
        filename: file.filename,
        status: mapStatus(file.status),
        patch: `[truncated — file diff exceeds size limit]`,
        additions: file.additions,
        deletions: file.deletions,
        previousFilename: file.previous_filename,
      });
      continue;
    }

    totalPatchBytes += patch.length;

    diffFiles.push({
      filename: file.filename,
      status: mapStatus(file.status),
      patch,
      additions: file.additions,
      deletions: file.deletions,
      previousFilename: file.previous_filename,
    });
  }

  return {
    base,
    head,
    files: diffFiles,
    totalAdditions: diffFiles.reduce((sum, f) => sum + f.additions, 0),
    totalDeletions: diffFiles.reduce((sum, f) => sum + f.deletions, 0),
  };
}

function mapStatus(
  status: string,
): DiffFile["status"] {
  switch (status) {
    case "added":
      return "added";
    case "removed":
      return "removed";
    case "renamed":
      return "renamed";
    default:
      return "modified";
  }
}
