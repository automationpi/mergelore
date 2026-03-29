"""Cohere embed-english-v3.0 provider."""

from __future__ import annotations

import cohere

from ..retry import with_retry


class CohereEmbedding:
    def __init__(self, api_key: str) -> None:
        self._client = cohere.AsyncClientV2(api_key=api_key)

    @property
    def name(self) -> str:
        return "embed-english-v3.0"

    @property
    def dimension(self) -> int:
        return 1024

    @with_retry(max_retries=3, base_delay=1.0)
    async def embed(self, texts: list[str]) -> list[list[float]]:
        response = await self._client.embed(
            texts=texts,
            model="embed-english-v3.0",
            input_type="search_document",
            embedding_types=["float"],
        )
        return [list(e) for e in response.embeddings.float_]
