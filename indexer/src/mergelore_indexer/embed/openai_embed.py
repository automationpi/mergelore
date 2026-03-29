"""OpenAI text-embedding-3-small provider."""

from __future__ import annotations

from openai import AsyncOpenAI

from ..retry import with_retry


class OpenAIEmbedding:
    def __init__(self, api_key: str) -> None:
        self._client = AsyncOpenAI(api_key=api_key)

    @property
    def name(self) -> str:
        return "text-embedding-3-small"

    @property
    def dimension(self) -> int:
        return 1536

    @with_retry(max_retries=3, base_delay=1.0)
    async def embed(self, texts: list[str]) -> list[list[float]]:
        response = await self._client.embeddings.create(
            input=texts,
            model="text-embedding-3-small",
        )
        return [item.embedding for item in response.data]
