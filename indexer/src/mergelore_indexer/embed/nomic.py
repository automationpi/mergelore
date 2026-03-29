"""Nomic embed-text v1.5 provider (local, CPU-friendly)."""

from __future__ import annotations


class NomicEmbedding:
    def __init__(self) -> None:
        try:
            from sentence_transformers import SentenceTransformer
        except ImportError:
            raise ImportError(
                "nomic-embed-text requires sentence-transformers. "
                "Install with: pip install 'mergelore-indexer[local]'"
            )
        self._model = SentenceTransformer("nomic-ai/nomic-embed-text-v1.5", trust_remote_code=True)

    @property
    def name(self) -> str:
        return "nomic-embed-text"

    @property
    def dimension(self) -> int:
        return 768

    async def embed(self, texts: list[str]) -> list[list[float]]:
        # sentence-transformers is sync, but fast enough for indexing
        prefixed = [f"search_document: {t}" for t in texts]
        embeddings = self._model.encode(prefixed)
        return [e.tolist() for e in embeddings]
