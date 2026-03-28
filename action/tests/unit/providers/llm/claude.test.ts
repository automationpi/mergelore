import { describe, it, expect, vi } from "vitest";

vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: class MockAnthropic {
      messages = {
        create: vi.fn(),
      };
    },
  };
});

import { ClaudeLLMProvider } from "../../../../src/providers/llm/claude.js";
import type { Diff, Context } from "../../../../src/types.js";

const makeDiff = (): Diff => ({
  base: "main",
  head: "feature/auth",
  files: [
    {
      filename: "src/auth.ts",
      status: "modified",
      patch: "@@ -1,5 +1,10 @@\n+import { legacyAuth } from './legacy';",
      additions: 5,
      deletions: 0,
    },
  ],
  totalAdditions: 5,
  totalDeletions: 0,
});

const makeContext = (): Context[] => [
  {
    prNumber: 42,
    prTitle: "Remove legacy auth",
    prUrl: "https://github.com/test/repo/pull/42",
    mergedAt: "2026-01-15",
    summary: "Removed legacy auth for compliance",
    relevanceScore: 0.9,
    filesOverlap: ["src/auth.ts"],
    author: "alice",
  },
];

describe("ClaudeLLMProvider", () => {
  it("has the correct name", () => {
    const provider = new ClaudeLLMProvider("sk-test");
    expect(provider.name).toBe("claude");
  });

  it("returns mapped findings from tool_use response", async () => {
    const provider = new ClaudeLLMProvider("sk-test");

    // Access the mock
    const mockCreate = (provider as any).client.messages.create;
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "tool_use",
          name: "report_findings",
          input: {
            findings: [
              {
                title: "Pattern reversal: legacy auth",
                explanation: "Re-introduces removed auth pattern",
                confidence: 0.88,
                severity: "warning",
                sourcePrNumber: 42,
                affectedFiles: ["src/auth.ts"],
              },
            ],
          },
        },
      ],
    });

    const findings = await provider.analyze(makeDiff(), makeContext());

    expect(findings).toHaveLength(1);
    expect(findings[0].title).toBe("Pattern reversal: legacy auth");
    expect(findings[0].confidence).toBe(0.88);
    expect(findings[0].severity).toBe("warning");
    expect(findings[0].sourceContext?.prNumber).toBe(42);
    expect(findings[0].affectedFiles).toEqual(["src/auth.ts"]);
  });

  it("returns empty array when no tool_use in response", async () => {
    const provider = new ClaudeLLMProvider("sk-test");
    const mockCreate = (provider as any).client.messages.create;
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: "No findings." }],
    });

    const findings = await provider.analyze(makeDiff(), []);
    expect(findings).toEqual([]);
  });

  it("clamps confidence to 0-1 range", async () => {
    const provider = new ClaudeLLMProvider("sk-test");
    const mockCreate = (provider as any).client.messages.create;
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "tool_use",
          name: "report_findings",
          input: {
            findings: [
              {
                title: "Overcofident",
                explanation: "test",
                confidence: 1.5,
                severity: "info",
                affectedFiles: [],
              },
              {
                title: "Negative",
                explanation: "test",
                confidence: -0.2,
                severity: "info",
                affectedFiles: [],
              },
            ],
          },
        },
      ],
    });

    const findings = await provider.analyze(makeDiff(), []);
    expect(findings[0].confidence).toBe(1);
    expect(findings[1].confidence).toBe(0);
  });
});
