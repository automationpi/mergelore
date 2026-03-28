import type { GitHub } from "@actions/github/lib/utils.js";
import type { Context as GitHubContext } from "@actions/github/lib/context.js";
import { logInfo } from "../logger.js";

type Octokit = InstanceType<typeof GitHub>;

const COMMANDS = [
  "mergelore-acknowledge",
  "mergelore-override",
  "mergelore-update-record",
] as const;

type Command = (typeof COMMANDS)[number];

interface ParsedCommand {
  command: Command;
  args: string;
}

function parseCommand(body: string): ParsedCommand | null {
  const trimmed = body.trim();

  for (const cmd of COMMANDS) {
    if (trimmed.startsWith(`/${cmd}`)) {
      const args = trimmed.slice(`/${cmd}`.length).trim();
      return { command: cmd, args };
    }
  }

  return null;
}

export async function handleSlashCommand(
  octokit: Octokit,
  context: GitHubContext,
): Promise<void> {
  const comment = context.payload.comment;
  if (!comment?.body) return;

  const parsed = parseCommand(comment.body);
  if (!parsed) return;

  const { owner, repo } = context.repo;
  const issueNumber = context.payload.issue?.number;
  if (!issueNumber) return;

  logInfo("slash_command_received", {
    command: parsed.command,
    pr: issueNumber,
    user: comment.user?.login,
  });

  // React to acknowledge we saw the command
  await octokit.rest.reactions.createForIssueComment({
    owner,
    repo,
    comment_id: comment.id,
    content: "+1",
  });

  switch (parsed.command) {
    case "mergelore-acknowledge":
      await handleAcknowledge(octokit, owner, repo, issueNumber);
      break;

    case "mergelore-override":
      await handleOverride(
        octokit,
        owner,
        repo,
        issueNumber,
        parsed.args,
        comment.user?.login ?? "unknown",
      );
      break;

    case "mergelore-update-record":
      await handleUpdateRecord(octokit, owner, repo, issueNumber);
      break;
  }
}

async function handleAcknowledge(
  octokit: Octokit,
  owner: string,
  repo: string,
  issueNumber: number,
): Promise<void> {
  await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: issueNumber,
    body: "> **mergelore**: Findings acknowledged. No further action needed.",
  });

  logInfo("acknowledge_processed", { pr: issueNumber });
}

async function handleOverride(
  octokit: Octokit,
  owner: string,
  repo: string,
  issueNumber: number,
  reason: string,
  user: string,
): Promise<void> {
  if (!reason) {
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body: "> **mergelore**: Override requires a reason. Usage: `/mergelore-override [reason]`",
    });
    return;
  }

  // Store override as hidden HTML comment for git-native memory
  const overrideRecord = JSON.stringify({
    type: "mergelore-override",
    reason,
    overriddenBy: user,
    timestamp: new Date().toISOString(),
    pr: issueNumber,
  });

  await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: issueNumber,
    body:
      `> **mergelore**: Finding overridden by @${user}.\n> Reason: ${reason}\n\n` +
      `<!-- mergelore-override: ${overrideRecord} -->`,
  });

  logInfo("override_processed", { pr: issueNumber, user, reason });
}

async function handleUpdateRecord(
  octokit: Octokit,
  owner: string,
  repo: string,
  issueNumber: number,
): Promise<void> {
  // Add label to signal re-indexing on merge
  try {
    await octokit.rest.issues.addLabels({
      owner,
      repo,
      issue_number: issueNumber,
      labels: ["mergelore:reindex"],
    });
  } catch {
    // Label may not exist yet — create it
    try {
      await octokit.rest.issues.createLabel({
        owner,
        repo,
        name: "mergelore:reindex",
        color: "7B61FF",
        description: "mergelore will re-index this PR after merge",
      });
      await octokit.rest.issues.addLabels({
        owner,
        repo,
        issue_number: issueNumber,
        labels: ["mergelore:reindex"],
      });
    } catch {
      // If we can't create labels, just comment
    }
  }

  await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: issueNumber,
    body: "> **mergelore**: This PR will be re-indexed after merge to update the decision record.",
  });

  logInfo("update_record_processed", { pr: issueNumber });
}
