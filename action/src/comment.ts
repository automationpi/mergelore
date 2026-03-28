import type { GitHub } from "@actions/github/lib/utils.js";
import type { Finding, ActionConfig } from "./types.js";

type Octokit = InstanceType<typeof GitHub>;

const VERSION = "0.1.0";
const COMMENT_MARKER = "## mergelore findings";

interface CommentMetadata {
  reviewedPRs: number;
  relevantDecisions: number;
}

export function formatComment(
  findings: Finding[],
  config: ActionConfig,
  metadata: CommentMetadata,
): string {
  const conflicts = findings.filter(
    (f) => f.severity === "critical" || f.severity === "warning",
  );
  const informational = findings.filter((f) => f.severity === "info");

  let body = COMMENT_MARKER + "\n\n";
  body += `> Reviewed ${metadata.reviewedPRs} past PRs · ${metadata.relevantDecisions} relevant decisions found · confidence threshold ${config.confidenceThreshold}\n\n`;

  if (conflicts.length > 0) {
    body += "### \u26a0\ufe0f Potential conflicts\n\n";
    for (const finding of conflicts) {
      body += `**${finding.title}** \u00b7 confidence: ${finding.confidence.toFixed(2)}\n`;
      body += `> ${finding.explanation}\n`;
      if (finding.sourceContext) {
        body += `> Source: [PR #${finding.sourceContext.prNumber}](${finding.sourceContext.prUrl}) \u00b7 ${finding.sourceContext.mergedAt}\n`;
      }
      body += "\n";
      body += "`/mergelore-acknowledge` \u00b7 `/mergelore-override [reason]` \u00b7 `/mergelore-update-record`\n\n";
    }
  } else {
    body += "### \u2705 No conflicts found\n\n";
    body += "No potential conflicts with past decisions were detected.\n\n";
  }

  body += "---\n\n";

  if (informational.length > 0) {
    body += "### \u2139\ufe0f Related context\n\n";
    for (const finding of informational) {
      body += `- **${finding.title}** (confidence: ${finding.confidence.toFixed(2)}): ${finding.explanation}`;
      if (finding.sourceContext) {
        body += ` — [PR #${finding.sourceContext.prNumber}](${finding.sourceContext.prUrl})`;
      }
      body += "\n";
    }
    body += "\n---\n";
  }

  body += `*mergelore v${VERSION} \u00b7 [docs](https://github.com/automationpi/mergelore)*\n`;

  return body;
}

export function formatDegradedComment(reason: string): string {
  let body = COMMENT_MARKER + "\n\n";
  body += `> \u26a0\ufe0f mergelore could not complete analysis: ${reason}\n\n`;
  body += "This PR was not blocked. mergelore will retry on the next push.\n\n";
  body += "---\n";
  body += `*mergelore v${VERSION} \u00b7 [docs](https://github.com/automationpi/mergelore)*\n`;
  return body;
}

export async function postOrUpdateComment(
  octokit: Octokit,
  owner: string,
  repo: string,
  pullNumber: number,
  body: string,
): Promise<void> {
  const { data: comments } = await octokit.rest.issues.listComments({
    owner,
    repo,
    issue_number: pullNumber,
    per_page: 100,
  });

  const existing = comments.find(
    (c) =>
      c.body?.startsWith(COMMENT_MARKER) &&
      c.performed_via_github_app?.slug === "github-actions",
  );

  if (existing) {
    await octokit.rest.issues.updateComment({
      owner,
      repo,
      comment_id: existing.id,
      body,
    });
  } else {
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: pullNumber,
      body,
    });
  }
}
