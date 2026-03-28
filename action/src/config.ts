import * as core from "@actions/core";
import type { ActionConfig, LLMProviderName, MemoryProviderName } from "./types.js";

const VALID_LLM_PROVIDERS: LLMProviderName[] = ["claude", "openai"];
const VALID_MEMORY_PROVIDERS: MemoryProviderName[] = ["none", "git-native"];

export function parseConfig(): ActionConfig {
  const llmProvider = core.getInput("llm-provider") || "claude";
  if (!VALID_LLM_PROVIDERS.includes(llmProvider as LLMProviderName)) {
    throw new Error(
      `mergelore: Invalid llm-provider "${llmProvider}". Valid options: ${VALID_LLM_PROVIDERS.join(", ")}`,
    );
  }

  const memoryProvider = core.getInput("memory-provider") || "git-native";
  if (!VALID_MEMORY_PROVIDERS.includes(memoryProvider as MemoryProviderName)) {
    throw new Error(
      `mergelore: Invalid memory-provider "${memoryProvider}". Valid options: ${VALID_MEMORY_PROVIDERS.join(", ")}`,
    );
  }

  const historyDepth = parseInt(core.getInput("history-depth") || "20", 10);
  if (isNaN(historyDepth) || historyDepth < 1) {
    throw new Error(
      `mergelore: history-depth must be a positive integer. Got: "${core.getInput("history-depth")}"`,
    );
  }

  const confidenceThreshold = parseFloat(
    core.getInput("confidence-threshold") || "0.3",
  );
  if (
    isNaN(confidenceThreshold) ||
    confidenceThreshold < 0 ||
    confidenceThreshold > 1
  ) {
    throw new Error(
      `mergelore: confidence-threshold must be between 0.0 and 1.0. Got: "${core.getInput("confidence-threshold")}"`,
    );
  }

  const anthropicApiKey = core.getInput("anthropic-api-key");
  if (llmProvider === "claude" && !anthropicApiKey) {
    throw new Error(
      "mergelore: anthropic-api-key is required when using the claude provider. Add it as a secret in your workflow.",
    );
  }

  return {
    anthropicApiKey,
    openaiApiKey: core.getInput("openai-api-key") || undefined,
    githubToken: process.env.GITHUB_TOKEN ?? "",
    memoryProvider: memoryProvider as MemoryProviderName,
    llmProvider: llmProvider as LLMProviderName,
    historyDepth,
    confidenceThreshold,
    vectorStoreUrl: core.getInput("vector-store-url") || undefined,
    blockOnCritical: core.getInput("block-on-critical") === "true",
    timeout: parseInt(core.getInput("timeout") || "45000", 10),
  };
}
