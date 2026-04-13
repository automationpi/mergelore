"""Embedding provider factory."""

from __future__ import annotations

from .interface import EmbeddingProvider
from .fastembed_embed import FastEmbedEmbedding, MODELS as FASTEMBED_MODELS

FASTEMBED_KEYS = list(FASTEMBED_MODELS.keys())

ALL_MODELS = FASTEMBED_KEYS + ["text-embedding-3-small", "embed-english-v3.0"]


def create_embedding_provider(
    model_name: str,
    openai_api_key: str | None = None,
    cohere_api_key: str | None = None,
) -> EmbeddingProvider:
    # FastEmbed models (local, no API key needed)
    if model_name in FASTEMBED_MODELS:
        return FastEmbedEmbedding(model_key=model_name)

    match model_name:
        case "text-embedding-3-small":
            try:
                from .openai_embed import OpenAIEmbedding
            except ImportError:
                raise ImportError(
                    "OpenAI embedding requires the openai package. "
                    "Install with: pip install 'mergelore-indexer[openai]'"
                )
            if not openai_api_key:
                raise ValueError("OPENAI_API_KEY is required for text-embedding-3-small.")
            return OpenAIEmbedding(api_key=openai_api_key)

        case "embed-english-v3.0":
            try:
                from .cohere_embed import CohereEmbedding
            except ImportError:
                raise ImportError(
                    "Cohere embedding requires the cohere package. "
                    "Install with: pip install 'mergelore-indexer[cohere]'"
                )
            if not cohere_api_key:
                raise ValueError("COHERE_API_KEY is required for embed-english-v3.0.")
            return CohereEmbedding(api_key=cohere_api_key)

        case _:
            raise ValueError(
                f"Unknown embedding model: '{model_name}'. "
                f"Valid options: {', '.join(ALL_MODELS)}"
            )
