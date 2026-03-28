import * as core from "@actions/core";
import * as github from "@actions/github";
import { parseConfig } from "./config.js";
import { extractDiff } from "./diff.js";
import { formatComment, formatDegradedComment, postOrUpdateComment } from "./comment.js";
import { createLLMProvider } from "./providers/llm/factory.js";
import { createMemoryProvider } from "./providers/memory/factory.js";
import { handleSlashCommand } from "./handlers/slash-commands.js";
import { logInfo, logError, logTiming } from "./logger.js";
import type { Context } from "./types.js";

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`mergelore: Operation timed out after ${ms}ms`)),
        ms,
      ),
    ),
  ]);
}

async function run(): Promise<void> {
  const startTime = Date.now();

  // Route slash commands on issue_comment events
  if (github.context.eventName === "issue_comment") {
    const token = process.env.GITHUB_TOKEN ?? core.getInput("github-token");
    const octokit = github.getOctokit(token);
    await handleSlashCommand(octokit, github.context);
    return;
  }

  // Main PR review flow
  const config = parseConfig();
  logInfo("action_started", {
    memoryProvider: config.memoryProvider,
    llmProvider: config.llmProvider,
    historyDepth: config.historyDepth,
    confidenceThreshold: config.confidenceThreshold,
  });

  const token = config.githubToken || core.getInput("github-token");
  if (!token) {
    core.setFailed(
      "mergelore: GITHUB_TOKEN is required. Ensure it is available in your workflow.",
    );
    return;
  }

  const octokit = github.getOctokit(token);
  const { owner, repo } = github.context.repo;
  const pr = github.context.payload.pull_request;

  if (!pr?.number) {
    core.setFailed(
      "mergelore: This action must run on pull_request events (opened, synchronize, reopened).",
    );
    return;
  }

  const pullNumber = pr.number;
  const base = pr.base?.ref ?? "main";
  const head = pr.head?.ref ?? "unknown";

  // Create providers (plugin architecture — swap via config)
  const llmProvider = createLLMProvider(config);
  const memoryProvider = createMemoryProvider({
    config,
    octokit,
    owner,
    repo,
  });

  logInfo("providers_created", {
    llm: llmProvider.name,
    memory: memoryProvider.name,
  });

  // Extract diff
  const diff = await extractDiff(octokit, owner, repo, pullNumber, base, head);
  logInfo("diff_extracted", {
    files: diff.files.length,
    additions: diff.totalAdditions,
    deletions: diff.totalDeletions,
  });

  if (diff.files.length === 0) {
    logInfo("empty_diff", { pr: pullNumber });
    return;
  }

  // Query memory for past decisions
  let context: Context[];
  try {
    context = await withTimeout(memoryProvider.query(diff), config.timeout);
  } catch (err) {
    logError("memory_query_failed", err);
    context = []; // Degrade gracefully — proceed without context
  }
  logInfo("context_retrieved", { count: context.length });

  // LLM analysis
  let findings;
  try {
    findings = await withTimeout(
      llmProvider.analyze(diff, context),
      config.timeout,
    );
  } catch (err) {
    logError("llm_unavailable", err);
    await postOrUpdateComment(
      octokit,
      owner,
      repo,
      pullNumber,
      formatDegradedComment("LLM API unavailable or timed out"),
    );
    return; // Don't fail CI
  }
  logInfo("analysis_complete", { findingsCount: findings.length });

  // Filter by confidence threshold
  const filtered = findings.filter(
    (f) => f.confidence >= config.confidenceThreshold,
  );

  // Post comment
  const comment = formatComment(filtered, config, {
    reviewedPRs: context.length,
    relevantDecisions: context.filter((c) => c.relevanceScore > 0.5).length,
  });
  await postOrUpdateComment(octokit, owner, repo, pullNumber, comment);

  logTiming("action_completed", startTime);

  // Block on critical (opt-in only)
  if (config.blockOnCritical) {
    const criticals = filtered.filter((f) => f.severity === "critical");
    if (criticals.length > 0) {
      core.setFailed(
        `mergelore: ${criticals.length} critical finding(s) detected. Review required before merging.`,
      );
    }
  }
}

run().catch((err) => {
  // Top-level catch: log but do NOT setFailed — graceful degradation
  logError("action_unexpected_error", err);
});
