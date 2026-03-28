import Anthropic from "@anthropic-ai/sdk";
import type { Diff, Context, Finding, LLMProvider } from "../../types.js";
import {
  buildSystemPrompt,
  buildUserMessage,
  mapRawFindings,
  FINDING_SCHEMA,
  type RawFinding,
} from "./prompts.js";
import { logInfo, logError } from "../../logger.js";

export class ClaudeLLMProvider implements LLMProvider {
  readonly name = "claude";
  private readonly client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async analyze(diff: Diff, context: Context[]): Promise<Finding[]> {
    logInfo("claude_request_started", {
      filesCount: diff.files.length,
      contextCount: context.length,
    });

    const startTime = Date.now();
    const response = await this.client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
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

    logInfo("claude_request_completed", {
      durationMs: Date.now() - startTime,
      inputTokens: response.usage?.input_tokens,
      outputTokens: response.usage?.output_tokens,
    });

    for (const block of response.content) {
      if (block.type === "tool_use" && block.name === "report_findings") {
        const input = block.input as { findings: RawFinding[] };
        const findings = mapRawFindings(input.findings, context);
        logInfo("claude_findings_parsed", { count: findings.length });
        return findings;
      }
    }

    logError("claude_no_tool_use", new Error("Response did not contain report_findings tool use"));
    return [];
  }
}
