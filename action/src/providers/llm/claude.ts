import Anthropic from "@anthropic-ai/sdk";
import type { Diff, Context, Finding, LLMProvider } from "../../types.js";
import {
  buildSystemPrompt,
  buildUserMessage,
  mapRawFindings,
  FINDING_SCHEMA,
  type RawFinding,
} from "./prompts.js";

export class ClaudeLLMProvider implements LLMProvider {
  readonly name = "claude";
  private readonly client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async analyze(diff: Diff, context: Context[]): Promise<Finding[]> {
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.client.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 8192,
          system: buildSystemPrompt(),
          tools: [
            {
              name: "report_findings",
              description:
                "Report the analysis findings for this PR diff. Call this tool with all findings.",
              input_schema: FINDING_SCHEMA,
            },
          ],
          tool_choice: { type: "tool", name: "report_findings" },
          messages: [{ role: "user", content: buildUserMessage(diff, context) }],
        });

        for (const block of response.content) {
          if (block.type === "tool_use" && block.name === "report_findings") {
            const input = block.input as { findings: RawFinding[] };
            return mapRawFindings(input.findings, context);
          }
        }

        return [];
      } catch (err) {
        if (attempt === maxRetries) throw err;
        // Exponential backoff: 1s, 2s, 4s
        await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
      }
    }

    return [];
  }
}
