"""Tests for embedding provider factory."""

import pytest

from mergelore_indexer.embed.factory import create_embedding_provider


def test_creates_openai_provider():
    provider = create_embedding_provider("text-embedding-3-small", openai_api_key="sk-test")
    assert provider.name == "text-embedding-3-small"
    assert provider.dimension == 1536


def test_openai_requires_key():
    with pytest.raises(ValueError, match="OPENAI_API_KEY"):
        create_embedding_provider("text-embedding-3-small")


def test_cohere_requires_key():
    with pytest.raises(ValueError, match="COHERE_API_KEY"):
        create_embedding_provider("embed-english-v3.0")


def test_creates_cohere_provider():
    provider = create_embedding_provider("embed-english-v3.0", cohere_api_key="co-test")
    assert provider.name == "embed-english-v3.0"
    assert provider.dimension == 1024


def test_unknown_model_raises():
    with pytest.raises(ValueError, match="Unknown embedding model"):
        create_embedding_provider("invalid-model")
