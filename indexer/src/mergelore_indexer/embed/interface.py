"""Embedding provider protocol."""

from __future__ import annotations

from typing import Protocol


class EmbeddingProvider(Protocol):
    @property
    def name(self) -> str: ...

    @property
    def dimension(self) -> int: ...

    async def embed(self, texts: list[str]) -> list[list[float]]: ...
