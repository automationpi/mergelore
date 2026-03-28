import type { Diff, Context, Finding, Severity } from "../../types.js";

export const FINDING_SCHEMA = {
  type: "object" as const,
  properties: {
    findings: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          title: {
            type: "string" as const,
            description: "Short title summarizing the finding",
          },
          explanation: {
            type: "string" as const,
            description:
              "Plain language explanation of what was decided before and why this PR may conflict",
          },
          confidence: {
            type: "number" as const,
            minimum: 0,
            maximum: 1,
            description: "Confidence score between 0.0 and 1.0",
          },
          severity: {
            type: "string" as const,
            enum: ["critical", "warning", "info"],
            description:
              "critical = likely regression, warning = potential conflict, info = related context",
          },
          sourcePrNumber: {
            type: "number" as const,
            description:
              "PR number from the provided context that this finding relates to, if any",
          },
          affectedFiles: {
            type: "array" as const,
            items: { type: "string" as const },
            description: "Files in the current diff affected by this finding",
          },
        },
        required: [
          "title",
          "explanation",
          "confidence",
          "severity",
          "affectedFiles",
        ],
      },
    },
  },
  required: ["findings"],
};

export function buildSystemPrompt(): string {
  return `You are mergelore, a code review tool that identifies when a pull request may conflict with past architectural decisions.

Your job:
1. Analyze the provided diff for structural and architectural implications.
2. Compare the diff against the provided context of past PR decisions.
3. Flag findings ONLY when you have genuine evidence of a conflict, pattern reversal, or constraint violation.

Rules:
- Every finding MUST have a confidence score between 0.0 and 1.0.
- Use "critical" severity only for likely regressions or clear violations of past decisions.
- Use "warning" for potential conflicts that deserve attention.
- Use "info" for related context that is informational, not blocking.
- NEVER fabricate source references. If a finding does not relate to a specific past PR, omit sourcePrNumber.
- If no context is provided, only flag structural issues visible in the diff itself (with lower confidence).
- Prefer fewer high-quality findings over many low-quality ones.
- Be specific about what was decided before and why the current change may conflict.`;
}

export function buildUserMessage(diff: Diff, context: Context[]): string {
  let message = "## Current PR Diff\n\n";

  for (const file of diff.files) {
    message += `### ${file.filename} (${file.status})\n`;
    if (file.patch) {
      message += "```diff\n" + file.patch + "\n```\n\n";
    }
  }

  if (context.length > 0) {
    message += "## Past PR Decisions (most relevant first)\n\n";
    for (const ctx of context) {
      message += `### PR #${ctx.prNumber}: ${ctx.prTitle}\n`;
      message += `- URL: ${ctx.prUrl}\n`;
      message += `- Merged: ${ctx.mergedAt}\n`;
      message += `- Author: ${ctx.author}\n`;
      message += `- Relevance: ${ctx.relevanceScore.toFixed(2)}\n`;
      message += `- Overlapping files: ${ctx.filesOverlap.join(", ") || "none"}\n`;
      message += `- Summary: ${ctx.summary}\n\n`;
    }
  } else {
    message +=
      "## Past PR Decisions\n\nNo historical context available. Analyze the diff on its own merits.\n";
  }

  return message;
}

export interface RawFinding {
  title: string;
  explanation: string;
  confidence: number;
  severity: Severity;
  sourcePrNumber?: number;
  affectedFiles: string[];
}

export function mapRawFindings(
  raw: RawFinding[],
  context: Context[],
): Finding[] {
  const contextByPr = new Map(context.map((c) => [c.prNumber, c]));

  return raw.map((r) => ({
    title: r.title,
    explanation: r.explanation,
    confidence: Math.max(0, Math.min(1, r.confidence)),
    severity: r.severity,
    sourceContext: r.sourcePrNumber
      ? contextByPr.get(r.sourcePrNumber)
      : undefined,
    affectedFiles: r.affectedFiles,
  }));
}
