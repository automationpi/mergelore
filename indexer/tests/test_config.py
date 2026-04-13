"""Tests for configuration loading."""

import pytest

from mergelore_indexer.config import load_config


@pytest.fixture(autouse=True)
def clean_env(monkeypatch):
    """Clear relevant env vars before each test."""
    for key in [
        "GITHUB_TOKEN", "MERGELORE_EMBED_MODEL", "MERGELORE_QDRANT_URL",
        "QDRANT_API_KEY", "OPENAI_API_KEY", "COHERE_API_KEY",
        "GITHUB_REPOSITORY", "GITHUB_EVENT_PATH",
    ]:
        monkeypatch.delenv(key, raising=False)


def set_valid_env(monkeypatch):
    """Set minimal valid env - uses default FastEmbed model, no API keys needed."""
    monkeypatch.setenv("GITHUB_TOKEN", "gh-test")
    monkeypatch.setenv("MERGELORE_QDRANT_URL", "http://qdrant:6333")
    monkeypatch.setenv("GITHUB_REPOSITORY", "owner/repo")


def test_loads_valid_config_with_defaults(monkeypatch):
    set_valid_env(monkeypatch)
    config = load_config()
    assert config.embed_model == "bge-small-en-v1.5"
    assert config.owner == "owner"
    assert config.repo == "repo"
    assert config.openai_api_key is None


def test_loads_openai_model(monkeypatch):
    set_valid_env(monkeypatch)
    monkeypatch.setenv("MERGELORE_EMBED_MODEL", "text-embedding-3-small")
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
    config = load_config()
    assert config.embed_model == "text-embedding-3-small"


def test_missing_github_token(monkeypatch):
    monkeypatch.setenv("MERGELORE_QDRANT_URL", "http://qdrant:6333")
    monkeypatch.setenv("GITHUB_REPOSITORY", "owner/repo")
    with pytest.raises(ValueError, match="GITHUB_TOKEN"):
        load_config()


def test_invalid_embed_model(monkeypatch):
    set_valid_env(monkeypatch)
    monkeypatch.setenv("MERGELORE_EMBED_MODEL", "invalid-model")
    with pytest.raises(ValueError, match="Invalid MERGELORE_EMBED_MODEL"):
        load_config()


def test_missing_qdrant_url(monkeypatch):
    monkeypatch.setenv("GITHUB_TOKEN", "gh-test")
    monkeypatch.setenv("GITHUB_REPOSITORY", "owner/repo")
    with pytest.raises(ValueError, match="MERGELORE_QDRANT_URL"):
        load_config()


def test_openai_model_requires_key(monkeypatch):
    set_valid_env(monkeypatch)
    monkeypatch.setenv("MERGELORE_EMBED_MODEL", "text-embedding-3-small")
    with pytest.raises(ValueError, match="OPENAI_API_KEY"):
        load_config()


def test_cohere_model_requires_key(monkeypatch):
    set_valid_env(monkeypatch)
    monkeypatch.setenv("MERGELORE_EMBED_MODEL", "embed-english-v3.0")
    with pytest.raises(ValueError, match="COHERE_API_KEY"):
        load_config()


def test_missing_github_repository(monkeypatch):
    monkeypatch.setenv("GITHUB_TOKEN", "gh-test")
    monkeypatch.setenv("MERGELORE_QDRANT_URL", "http://qdrant:6333")
    with pytest.raises(ValueError, match="GITHUB_REPOSITORY"):
        load_config()
