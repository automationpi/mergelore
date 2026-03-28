import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @actions/core before importing config
vi.mock("@actions/core", () => {
  const inputs: Record<string, string> = {};
  return {
    getInput: (name: string) => inputs[name] ?? "",
    __setInputs: (map: Record<string, string>) => {
      Object.keys(inputs).forEach((k) => delete inputs[k]);
      Object.assign(inputs, map);
    },
  };
});

import * as core from "@actions/core";
import { parseConfig } from "../../src/config.js";

const setInputs = (core as unknown as { __setInputs: (m: Record<string, string>) => void }).__setInputs;

beforeEach(() => {
  setInputs({});
  delete process.env.GITHUB_TOKEN;
});

describe("parseConfig", () => {
  it("returns defaults for minimal inputs", () => {
    setInputs({ "anthropic-api-key": "sk-test" });
    process.env.GITHUB_TOKEN = "gh-token";

    const config = parseConfig();

    expect(config.llmProvider).toBe("claude");
    expect(config.memoryProvider).toBe("git-native");
    expect(config.historyDepth).toBe(20);
    expect(config.confidenceThreshold).toBe(0.7);
    expect(config.blockOnCritical).toBe(false);
    expect(config.timeout).toBe(45000);
  });

  it("parses all custom inputs", () => {
    setInputs({
      "anthropic-api-key": "sk-test",
      "openai-api-key": "sk-openai",
      "llm-provider": "openai",
      "memory-provider": "none",
      "history-depth": "50",
      "confidence-threshold": "0.5",
      "block-on-critical": "true",
      timeout: "30000",
    });
    process.env.GITHUB_TOKEN = "gh-token";

    const config = parseConfig();

    expect(config.llmProvider).toBe("openai");
    expect(config.memoryProvider).toBe("none");
    expect(config.historyDepth).toBe(50);
    expect(config.confidenceThreshold).toBe(0.5);
    expect(config.blockOnCritical).toBe(true);
    expect(config.openaiApiKey).toBe("sk-openai");
  });

  it("throws on invalid llm-provider", () => {
    setInputs({
      "anthropic-api-key": "sk-test",
      "llm-provider": "gemini",
    });

    expect(() => parseConfig()).toThrow("Invalid llm-provider");
    expect(() => parseConfig()).toThrow("gemini");
  });

  it("throws on invalid memory-provider", () => {
    setInputs({
      "anthropic-api-key": "sk-test",
      "memory-provider": "redis",
    });

    expect(() => parseConfig()).toThrow("Invalid memory-provider");
    expect(() => parseConfig()).toThrow("redis");
  });

  it("throws on negative history-depth", () => {
    setInputs({
      "anthropic-api-key": "sk-test",
      "history-depth": "-5",
    });

    expect(() => parseConfig()).toThrow("positive integer");
  });

  it("throws on confidence-threshold > 1", () => {
    setInputs({
      "anthropic-api-key": "sk-test",
      "confidence-threshold": "1.5",
    });

    expect(() => parseConfig()).toThrow("between 0.0 and 1.0");
  });

  it("throws on confidence-threshold < 0", () => {
    setInputs({
      "anthropic-api-key": "sk-test",
      "confidence-threshold": "-0.1",
    });

    expect(() => parseConfig()).toThrow("between 0.0 and 1.0");
  });

  it("throws when claude provider has no api key", () => {
    setInputs({ "llm-provider": "claude" });

    expect(() => parseConfig()).toThrow("anthropic-api-key is required");
  });
});
