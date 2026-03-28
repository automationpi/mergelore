import { describe, it, expect } from "vitest";
import { formatComment, formatDegradedComment } from "../../src/comment.js";
import type { Finding, ActionConfig, Context } from "../../src/types.js";

function makeConfig(overrides: Partial<ActionConfig> = {}): ActionConfig {
  return {
    anthropicApiKey: "test-key",
    githubToken: "test-token",
    memoryProvider: "git-native",
    llmProvider: "claude",
    historyDepth: 20,
    confidenceThreshold: 0.7,
    blockOnCritical: false,
    timeout: 45000,
    ...overrides,
  };
}

function makeContext(overrides: Partial<Context> = {}): Context {
  return {
    prNumber: 42,
    prTitle: "Remove legacy auth middleware",
    prUrl: "https://github.com/test/repo/pull/42",
    mergedAt: "2026-01-15",
    summary: "Removed old auth middleware due to compliance issues",
    relevanceScore: 0.8,
    filesOverlap: ["src/auth.ts"],
    author: "alice",
    ...overrides,
  };
}

function makeFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    title: "Pattern reversal: legacy auth middleware",
    explanation: "This PR re-introduces the auth middleware that was removed in PR #42.",
    confidence: 0.85,
    severity: "warning",
    affectedFiles: ["src/auth.ts"],
    ...overrides,
  };
}

describe("formatComment", () => {
  it("produces the locked header format", () => {
    const result = formatComment([], makeConfig(), {
      reviewedPRs: 5,
      relevantDecisions: 2,
    });

    expect(result).toContain("## mergelore findings");
    expect(result).toContain("Reviewed 5 past PRs");
    expect(result).toContain("2 relevant decisions found");
    expect(result).toContain("confidence threshold 0.7");
    expect(result).toContain("mergelore v0.1.0");
    expect(result).toContain("https://github.com/automationpi/mergelore");
  });

  it("shows no-conflicts message when findings are empty", () => {
    const result = formatComment([], makeConfig(), {
      reviewedPRs: 3,
      relevantDecisions: 0,
    });

    expect(result).toContain("No conflicts found");
    expect(result).not.toContain("Potential conflicts");
  });

  it("renders warning/critical findings in conflicts section", () => {
    const ctx = makeContext();
    const findings: Finding[] = [
      makeFinding({ sourceContext: ctx }),
      makeFinding({
        title: "Critical: DB connection limit",
        severity: "critical",
        confidence: 0.95,
      }),
    ];

    const result = formatComment(findings, makeConfig(), {
      reviewedPRs: 10,
      relevantDecisions: 3,
    });

    expect(result).toContain("Potential conflicts");
    expect(result).toContain("Pattern reversal: legacy auth middleware");
    expect(result).toContain("confidence: 0.85");
    expect(result).toContain("Critical: DB connection limit");
    expect(result).toContain("confidence: 0.95");
    expect(result).toContain("PR #42");
    expect(result).toContain("/mergelore-acknowledge");
    expect(result).toContain("/mergelore-override [reason]");
    expect(result).toContain("/mergelore-update-record");
  });

  it("renders info findings in related context section", () => {
    const findings: Finding[] = [
      makeFinding({
        title: "Related: config format migration",
        severity: "info",
        confidence: 0.6,
      }),
    ];

    const result = formatComment(findings, makeConfig(), {
      reviewedPRs: 5,
      relevantDecisions: 1,
    });

    expect(result).toContain("Related context");
    expect(result).toContain("Related: config format migration");
    expect(result).toContain("confidence: 0.60");
  });

  it("separates conflicts and informational findings", () => {
    const findings: Finding[] = [
      makeFinding({ severity: "warning" }),
      makeFinding({ title: "Info finding", severity: "info", confidence: 0.5 }),
    ];

    const result = formatComment(findings, makeConfig(), {
      reviewedPRs: 5,
      relevantDecisions: 2,
    });

    expect(result).toContain("Potential conflicts");
    expect(result).toContain("Related context");
  });

  it("includes confidence on every finding", () => {
    const findings: Finding[] = [
      makeFinding({ confidence: 0.92, severity: "critical" }),
      makeFinding({ confidence: 0.73, severity: "warning" }),
      makeFinding({ confidence: 0.45, severity: "info" }),
    ];

    const result = formatComment(findings, makeConfig(), {
      reviewedPRs: 3,
      relevantDecisions: 1,
    });

    expect(result).toContain("0.92");
    expect(result).toContain("0.73");
    expect(result).toContain("0.45");
  });
});

describe("formatDegradedComment", () => {
  it("includes the reason and non-blocking message", () => {
    const result = formatDegradedComment("LLM API unavailable");

    expect(result).toContain("## mergelore findings");
    expect(result).toContain("LLM API unavailable");
    expect(result).toContain("not blocked");
    expect(result).toContain("mergelore v0.1.0");
  });
});
