// --- Diff types ---

export interface DiffFile {
  filename: string;
  status: "added" | "modified" | "removed" | "renamed";
  patch: string;
  additions: number;
  deletions: number;
  previousFilename?: string;
}

export interface Diff {
  base: string;
  head: string;
  files: DiffFile[];
  totalAdditions: number;
  totalDeletions: number;
}

// --- Memory types ---

export interface Context {
  prNumber: number;
  prTitle: string;
  prUrl: string;
  mergedAt: string;
  summary: string;
  relevanceScore: number;
  filesOverlap: string[];
  author: string;
}

export interface MergedPR {
  number: number;
  title: string;
  body: string;
  url: string;
  mergedAt: string;
  author: string;
  files: string[];
  reviewComments: string[];
  labels: string[];
}

// --- Finding types ---

export type Severity = "critical" | "warning" | "info";

export interface Finding {
  title: string;
  explanation: string;
  confidence: number;
  severity: Severity;
  sourceContext?: Context;
  affectedFiles: string[];
}

// --- Provider interfaces ---

export interface LLMProvider {
  readonly name: string;
  analyze(diff: Diff, context: Context[]): Promise<Finding[]>;
}

export interface MemoryProvider {
  readonly name: string;
  index(pr: MergedPR): Promise<void>;
  query(diff: Diff): Promise<Context[]>;
}

// --- Config ---

export type LLMProviderName = "claude" | "openai";
export type MemoryProviderName = "none" | "git-native";

export interface ActionConfig {
  anthropicApiKey: string;
  openaiApiKey?: string;
  githubToken: string;
  memoryProvider: MemoryProviderName;
  llmProvider: LLMProviderName;
  historyDepth: number;
  confidenceThreshold: number;
  vectorStoreUrl?: string;
  blockOnCritical: boolean;
  timeout: number;
}

// --- Logging ---

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEvent {
  timestamp: string;
  level: LogLevel;
  event: string;
  data?: Record<string, unknown>;
  durationMs?: number;
}
