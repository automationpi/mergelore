import type { GitHub } from "@actions/github/lib/utils.js";
import * as core from "@actions/core";
import type { Diff, Context, MergedPR, MemoryProvider } from "../../types.js";
import { GitNativeMemoryProvider } from "./git-native.js";
import { logInfo, logError } from "../../logger.js";

type Octokit = InstanceType<typeof GitHub>;

interface QdrantOptions {
  vectorStoreUrl: string;
  apiKey?: string;
  octokit: Octokit;
  owner: string;
  repo: string;
  historyDepth: number;
}

interface QdrantPoint {
  id: string;
  payload: {
    pr_number: number;
    pr_title: string;
    pr_url: string;
    merged_at: string;
    author: string;
    files_touched: string[];
    chunk_text: string;
    chunk_index: number;
    total_chunks: number;
  };
}

interface QdrantScrollResponse {
  result: {
    points: QdrantPoint[];
    next_page_offset?: string | null;
  };
}

export class QdrantMemoryProvider implements MemoryProvider {
  readonly name = "qdrant";
  private readonly vectorStoreUrl: string;
  private readonly apiKey?: string;
  private readonly collectionName: string;
  private readonly fallback: GitNativeMemoryProvider;

  constructor(options: QdrantOptions) {
    this.vectorStoreUrl = options.vectorStoreUrl.replace(/\/$/, "");
    this.apiKey = options.apiKey;
    this.collectionName = `mergelore-${options.owner}-${options.repo}`.toLowerCase();
    this.fallback = new GitNativeMemoryProvider({
      octokit: options.octokit,
      owner: options.owner,
      repo: options.repo,
      historyDepth: options.historyDepth,
    });
  }

  async index(_pr: MergedPR): Promise<void> {
    // No-op — indexing is done by the Python indexer service
  }

  async query(diff: Diff): Promise<Context[]> {
    const currentFiles = diff.files.map((f) => f.filename);
    if (currentFiles.length === 0) return [];

    try {
      const points = await this.scrollByFiles(currentFiles);
      if (points.length === 0) return [];

      const contexts = this.deduplicateAndScore(points, new Set(currentFiles));

      logInfo("qdrant_query_complete", {
        pointsReturned: points.length,
        uniquePRs: contexts.length,
      });

      return contexts;
    } catch (err) {
      logError("qdrant_query_failed", err);
      core.warning(
        `mergelore: Qdrant query failed, falling back to git-native. Error: ${err instanceof Error ? err.message : String(err)}`,
      );
      return this.fallback.query(diff);
    }
  }

  private async scrollByFiles(files: string[]): Promise<QdrantPoint[]> {
    const url = `${this.vectorStoreUrl}/collections/${this.collectionName}/points/scroll`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.apiKey) {
      headers["api-key"] = this.apiKey;
    }

    const body = {
      filter: {
        should: files.map((f) => ({
          key: "files_touched",
          match: { value: f },
        })),
      },
      limit: 100,
      with_payload: true,
      with_vector: false,
    };

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(2000),
    });

    if (!response.ok) {
      throw new Error(`Qdrant returned ${response.status}: ${await response.text()}`);
    }

    const data = (await response.json()) as QdrantScrollResponse;
    return data.result.points;
  }

  private deduplicateAndScore(
    points: QdrantPoint[],
    currentFiles: Set<string>,
  ): Context[] {
    // Group chunks by PR number
    const byPR = new Map<number, QdrantPoint[]>();
    for (const point of points) {
      const prNum = point.payload.pr_number;
      const existing = byPR.get(prNum) ?? [];
      existing.push(point);
      byPR.set(prNum, existing);
    }

    const contexts: Context[] = [];
    for (const [, chunks] of byPR) {
      const first = chunks[0].payload;
      const allFiles = new Set(chunks.flatMap((c) => c.payload.files_touched));
      const filesOverlap = [...allFiles].filter((f) => currentFiles.has(f));

      if (filesOverlap.length === 0) continue;

      const relevanceScore =
        currentFiles.size > 0 ? filesOverlap.length / currentFiles.size : 0;

      // Use the first chunk's text as summary
      const summary = first.chunk_text.slice(0, 500);

      contexts.push({
        prNumber: first.pr_number,
        prTitle: first.pr_title,
        prUrl: first.pr_url,
        mergedAt: first.merged_at,
        summary,
        relevanceScore,
        filesOverlap,
        author: first.author,
      });
    }

    contexts.sort((a, b) => b.relevanceScore - a.relevanceScore);
    return contexts.slice(0, 10);
  }
}
