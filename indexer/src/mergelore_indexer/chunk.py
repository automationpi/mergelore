"""Text chunking with token-level sliding window."""

from __future__ import annotations

from dataclasses import dataclass

import tiktoken

ENCODING = tiktoken.get_encoding("cl100k_base")
CHUNK_SIZE = 512
OVERLAP = 64
STRIDE = CHUNK_SIZE - OVERLAP


@dataclass
class Chunk:
    text: str
    index: int
    total: int


def chunk_text(text: str) -> list[Chunk]:
    """Split text into chunks of CHUNK_SIZE tokens with OVERLAP token overlap."""
    if not text.strip():
        return []

    tokens = ENCODING.encode(text)
    total_tokens = len(tokens)

    if total_tokens <= CHUNK_SIZE:
        return [Chunk(text=ENCODING.decode(tokens), index=0, total=1)]

    chunks: list[Chunk] = []
    start = 0

    while start < total_tokens:
        end = min(start + CHUNK_SIZE, total_tokens)
        chunk_tokens = tokens[start:end]
        chunks.append(Chunk(
            text=ENCODING.decode(chunk_tokens),
            index=len(chunks),
            total=0,  # filled in below
        ))
        if end >= total_tokens:
            break
        start += STRIDE

    # Set total on all chunks
    total = len(chunks)
    return [Chunk(text=c.text, index=c.index, total=total) for c in chunks]
