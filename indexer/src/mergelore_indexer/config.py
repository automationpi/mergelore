"""Configuration from environment variables."""

from __future__ import annotations

import os
from dataclasses import dataclass

from .embed.factory import ALL_MODELS

DEFAULT_EMBED_MODEL = "bge-small-en-v1.5"


@dataclass(frozen=True)
class IndexerConfig:
    github_token: str
    embed_model: str
    qdrant_url: str
    qdrant_api_key: str | None
    openai_api_key: str | None
    cohere_api_key: str | None
    github_repository: str  # "owner/repo"
    github_event_path: str | None

    @property
    def owner(self) -> str:
        return self.github_repository.split("/")[0]

    @property
    def repo(self) -> str:
        return self.github_repository.split("/")[1]


def load_config() -> IndexerConfig:
    github_token = os.environ.get("GITHUB_TOKEN", "")
    if not github_token:
        raise ValueError("GITHUB_TOKEN is required.")

    embed_model = os.environ.get("MERGELORE_EMBED_MODEL", DEFAULT_EMBED_MODEL)
    if embed_model not in ALL_MODELS:
        raise ValueError(
            f"Invalid MERGELORE_EMBED_MODEL: '{embed_model}'. "
            f"Valid options: {', '.join(ALL_MODELS)}"
        )

    qdrant_url = os.environ.get("MERGELORE_QDRANT_URL", "")
    if not qdrant_url:
        raise ValueError("MERGELORE_QDRANT_URL is required.")

    openai_api_key = os.environ.get("OPENAI_API_KEY")
    if embed_model == "text-embedding-3-small" and not openai_api_key:
        raise ValueError("OPENAI_API_KEY is required when using text-embedding-3-small.")

    cohere_api_key = os.environ.get("COHERE_API_KEY")
    if embed_model == "embed-english-v3.0" and not cohere_api_key:
        raise ValueError("COHERE_API_KEY is required when using embed-english-v3.0.")

    github_repository = os.environ.get("GITHUB_REPOSITORY", "")
    if not github_repository or "/" not in github_repository:
        raise ValueError("GITHUB_REPOSITORY must be set to 'owner/repo'.")

    return IndexerConfig(
        github_token=github_token,
        embed_model=embed_model,
        qdrant_url=qdrant_url,
        qdrant_api_key=os.environ.get("QDRANT_API_KEY"),
        openai_api_key=openai_api_key,
        cohere_api_key=cohere_api_key,
        github_repository=github_repository,
        github_event_path=os.environ.get("GITHUB_EVENT_PATH"),
    )
