import type { GitHub } from "@actions/github/lib/utils.js";
import type { Diff, Context, MergedPR, MemoryProvider } from "../../types.js";

type Octokit = InstanceType<typeof GitHub>;

interface GitNativeOptions {
  octokit: Octokit;
  owner: string;
  repo: string;
  historyDepth: number;
}

export class GitNativeMemoryProvider implements MemoryProvider {
  readonly name = "git-native";
  private readonly octokit: Octokit;
  private readonly owner: string;
  private readonly repo: string;
  private readonly historyDepth: number;

  constructor(options: GitNativeOptions) {
    this.octokit = options.octokit;
    this.owner = options.owner;
    this.repo = options.repo;
    this.historyDepth = options.historyDepth;
  }

  async index(_pr: MergedPR): Promise<void> {
    // No-op for git-native: GitHub API is the implicit store.
    // Indexing is handled by the async indexer service (v0.2.0+).
  }

  async query(diff: Diff): Promise<Context[]> {
    const currentFiles = new Set(diff.files.map((f) => f.filename));

    const { data: pulls } = await this.octokit.rest.pulls.list({
      owner: this.owner,
      repo: this.repo,
      state: "closed",
      sort: "updated",
      direction: "desc",
      per_page: this.historyDepth,
    });

    const mergedPulls = pulls.filter((pr) => pr.merged_at !== null);
    if (mergedPulls.length === 0) return [];

    // Fetch files for each merged PR in parallel batches
    const batchSize = 10;
    const contexts: Context[] = [];

    for (let i = 0; i < mergedPulls.length; i += batchSize) {
      const batch = mergedPulls.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map((pr) => this.buildContext(pr, currentFiles)),
      );
      for (const ctx of results) {
        if (ctx) contexts.push(ctx);
      }
    }

    // Sort by relevance descending (FR-03.8)
    contexts.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Return top 10 to avoid overwhelming the LLM
    return contexts.slice(0, 10);
  }

  private async buildContext(
    pr: { number: number; title: string; html_url: string; merged_at: string | null; body: string | null; user: { login: string } | null },
    currentFiles: Set<string>,
  ): Promise<Context | null> {
    const { data: files } = await this.octokit.rest.pulls.listFiles({
      owner: this.owner,
      repo: this.repo,
      pull_number: pr.number,
      per_page: 100,
    });

    const prFiles = files.map((f) => f.filename);
    const filesOverlap = prFiles.filter((f) => currentFiles.has(f));

    if (filesOverlap.length === 0) return null;

    const relevanceScore = currentFiles.size > 0
      ? filesOverlap.length / currentFiles.size
      : 0;

    return {
      prNumber: pr.number,
      prTitle: pr.title,
      prUrl: pr.html_url,
      mergedAt: pr.merged_at ?? "",
      summary: pr.body?.slice(0, 500) ?? "",
      relevanceScore,
      filesOverlap,
      author: pr.user?.login ?? "unknown",
    };
  }
}
