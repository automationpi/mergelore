"""Vector store protocol."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


@dataclass
class ChunkPayload:
    pr_number: int
    pr_title: str
    pr_url: str
    merged_at: str
    author: str
    files_touched: list[str]
    chunk_text: str
    chunk_index: int
    total_chunks: int


class VectorStore(Protocol):
    async def ensure_collection(self, dimension: int) -> None: ...

    async def upsert(
        self, chunks: list[ChunkPayload], vectors: list[list[float]]
    ) -> int: ...
