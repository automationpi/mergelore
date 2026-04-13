"""Tests for embedding provider factory."""

import pytest

from mergelore_indexer.embed.factory import create_embedding_provider


def test_creates_fastembed_default():
    provider = create_embedding_provider("bge-small-en-v1.5")
    assert provider.name == "fastembed"
    assert provider.dimension == 384


def test_creates_fastembed_minilm():
    provider = create_embedding_provider("all-MiniLM-L6-v2")
    assert provider.name == "fastembed"
    assert provider.dimension == 384


def test_creates_fastembed_nomic():
    provider = create_embedding_provider("nomic-embed-text-v1.5")
    assert provider.name == "fastembed"
    assert provider.dimension == 768


def test_openai_requires_key():
    with pytest.raises((ValueError, ImportError)):
        create_embedding_provider("text-embedding-3-small")


def test_cohere_requires_key():
    with pytest.raises((ValueError, ImportError)):
        create_embedding_provider("embed-english-v3.0")


def test_unknown_model_raises():
    with pytest.raises(ValueError, match="Unknown embedding model"):
        create_embedding_provider("invalid-model")
