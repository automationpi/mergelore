import * as core from "@actions/core";
import type { LogEvent, LogLevel } from "./types.js";

function emit(level: LogLevel, line: string): void {
  switch (level) {
    case "debug":
      core.debug(line);
      break;
    case "info":
      core.info(line);
      break;
    case "warn":
      core.warning(line);
      break;
    case "error":
      core.error(line);
      break;
  }
}

export function logEvent(event: LogEvent): void {
  emit(event.level, JSON.stringify(event));
}

export function logInfo(
  event: string,
  data?: Record<string, unknown>,
): void {
  logEvent({
    timestamp: new Date().toISOString(),
    level: "info",
    event,
    data,
  });
}

export function logError(event: string, error: unknown): void {
  logEvent({
    timestamp: new Date().toISOString(),
    level: "error",
    event,
    data: {
      message: error instanceof Error ? error.message : String(error),
    },
  });
}

export function logTiming(event: string, startMs: number): void {
  logEvent({
    timestamp: new Date().toISOString(),
    level: "info",
    event,
    durationMs: Date.now() - startMs,
  });
}
