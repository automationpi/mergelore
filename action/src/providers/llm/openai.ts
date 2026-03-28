import OpenAI from "openai";
import type { Diff, Context, Finding, LLMProvider } from "../../types.js";
import {
  buildSystemPrompt,
  buildUserMessage,
  mapRawFindings,
  FINDING_SCHEMA,
  type RawFinding,
} from "./prompts.js";

export class OpenAILLMProvider implements LLMProvider {
  readonly name = "openai";
  private readonly client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async analyze(diff: Diff, context: Context[]): Promise<Finding[]> {
    const response = await this.client.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 4096,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "findings_report",
          strict: true,
          schema: FINDING_SCHEMA,
        },
      },
      messages: [
        { role: "system", content: buildSystemPrompt() },
        { role: "user", content: buildUserMessage(diff, context) },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return [];

    const parsed = JSON.parse(content) as { findings: RawFinding[] };
    return mapRawFindings(parsed.findings, context);
  }
}
