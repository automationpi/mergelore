import type { ActionConfig, LLMProvider } from "../../types.js";
import { ClaudeLLMProvider } from "./claude.js";
import { OpenAILLMProvider } from "./openai.js";

export function createLLMProvider(config: ActionConfig): LLMProvider {
  switch (config.llmProvider) {
    case "claude":
      return new ClaudeLLMProvider(config.anthropicApiKey);

    case "openai":
      if (!config.openaiApiKey) {
        throw new Error(
          'mergelore: openai provider requires OPENAI_API_KEY. Add it as a secret in your workflow and pass it via the "openai-api-key" input.',
        );
      }
      return new OpenAILLMProvider(config.openaiApiKey);

    default: {
      const exhaustive: never = config.llmProvider;
      throw new Error(
        `mergelore: Unknown LLM provider "${exhaustive}". Valid options: claude, openai`,
      );
    }
  }
}
