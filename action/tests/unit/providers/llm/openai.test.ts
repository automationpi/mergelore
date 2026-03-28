import { describe, it, expect, vi } from "vitest";

vi.mock("openai", () => {
  return {
    default: class MockOpenAI {
      chat = {
        completions: {
          create: vi.fn(),
        },
      };
    },
  };
});

import { OpenAILLMProvider } from "../../../../src/providers/llm/openai.js";
import type { Diff } from "../../../../src/types.js";

const makeDiff = (): Diff => ({
  base: "main",
  head: "feature/config",
  files: [
    {
      filename: "src/config.ts",
      status: "modified",
      patch: "@@ -1,3 +1,8 @@\n+const MAX_RETRIES = 10;",
      additions: 5,
      deletions: 0,
    },
  ],
  totalAdditions: 5,
  totalDeletions: 0,
});

describe("OpenAILLMProvider", () => {
  it("has the correct name", () => {
    const provider = new OpenAILLMProvider("sk-test");
    expect(provider.name).toBe("openai");
  });

  it("parses structured JSON response into findings", async () => {
    const provider = new OpenAILLMProvider("sk-test");
    const mockCreate = (provider as any).client.chat.completions.create;

    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              findings: [
                {
                  title: "Config limit change",
                  explanation: "MAX_RETRIES was previously set to 3 for a reason.",
                  confidence: 0.75,
                  severity: "warning",
                  affectedFiles: ["src/config.ts"],
                },
              ],
            }),
          },
        },
      ],
    });

    const findings = await provider.analyze(makeDiff(), []);

    expect(findings).toHaveLength(1);
    expect(findings[0].title).toBe("Config limit change");
    expect(findings[0].confidence).toBe(0.75);
    expect(findings[0].severity).toBe("warning");
  });

  it("returns empty array when response has no content", async () => {
    const provider = new OpenAILLMProvider("sk-test");
    const mockCreate = (provider as any).client.chat.completions.create;

    mockCreate.mockResolvedValue({
      choices: [{ message: { content: null } }],
    });

    const findings = await provider.analyze(makeDiff(), []);
    expect(findings).toEqual([]);
  });
});
