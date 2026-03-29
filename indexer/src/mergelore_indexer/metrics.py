"""Structured metrics emission."""

from __future__ import annotations

import json
import sys
import time
from dataclasses import dataclass, field


@dataclass
class Metrics:
    documents_indexed: int = 0
    chunks_created: int = 0
    errors: int = 0
    embedding_latencies_ms: list[float] = field(default_factory=list)

    def record_embedding_latency(self, start_time: float) -> None:
        self.embedding_latencies_ms.append((time.time() - start_time) * 1000)

    def emit_summary(self) -> None:
        latencies = sorted(self.embedding_latencies_ms)
        p50 = latencies[len(latencies) // 2] if latencies else 0
        p95 = latencies[int(len(latencies) * 0.95)] if latencies else 0

        summary = {
            "event": "indexer_run_complete",
            "documents_indexed": self.documents_indexed,
            "chunks_created": self.chunks_created,
            "errors": self.errors,
            "embedding_latency_p50_ms": round(p50, 2),
            "embedding_latency_p95_ms": round(p95, 2),
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }
        print(json.dumps(summary), file=sys.stdout, flush=True)


def emit_event(event: str, **data: object) -> None:
    line = {
        "event": event,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        **data,
    }
    print(json.dumps(line), file=sys.stdout, flush=True)
