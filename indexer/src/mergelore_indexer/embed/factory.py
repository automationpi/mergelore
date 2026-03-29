"""Embedding provider factory."""

from __future__ import annotations

from .interface import EmbeddingProvider
from .openai_embed import OpenAIEmbedding
from .nomic import NomicEmbedding
from .cohere_embed import CohereEmbedding


def create_embedding_provider(
    model_name: str,
    openai_api_key: str | None = None,
    cohere_api_key: str | None = None,
) -> EmbeddingProvider:
    match model_name:
        case "text-embedding-3-small":
            if not openai_api_key:
                raise ValueError("OPENAI_API_KEY is required for text-embedding-3-small.")
            return OpenAIEmbedding(api_key=openai_api_key)

        case "nomic-embed-text":
            return NomicEmbedding()

        case "embed-english-v3.0":
            if not cohere_api_key:
                raise ValueError("COHERE_API_KEY is required for embed-english-v3.0.")
            return CohereEmbedding(api_key=cohere_api_key)

        case _:
            raise ValueError(
                f"Unknown embedding model: '{model_name}'. "
                f"Valid options: text-embedding-3-small, nomic-embed-text, embed-english-v3.0"
            )
