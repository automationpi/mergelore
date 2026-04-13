"""FastEmbed provider - local ONNX-based embedding (no API key needed)."""

from __future__ import annotations

from fastembed import TextEmbedding


MODELS = {
    "bge-small-en-v1.5": {"name": "BAAI/bge-small-en-v1.5", "dimension": 384},
    "all-MiniLM-L6-v2": {"name": "sentence-transformers/all-MiniLM-L6-v2", "dimension": 384},
    "nomic-embed-text-v1.5": {"name": "nomic-ai/nomic-embed-text-v1.5", "dimension": 768},
}

DEFAULT_MODEL = "bge-small-en-v1.5"


class FastEmbedEmbedding:
    def __init__(self, model_key: str = DEFAULT_MODEL) -> None:
        if model_key not in MODELS:
            raise ValueError(
                f"Unknown FastEmbed model: '{model_key}'. "
                f"Valid options: {', '.join(MODELS.keys())}"
            )
        model_info = MODELS[model_key]
        self._dimension = model_info["dimension"]
        self._model = TextEmbedding(model_name=model_info["name"])

    @property
    def name(self) -> str:
        return "fastembed"

    @property
    def dimension(self) -> int:
        return self._dimension

    async def embed(self, texts: list[str]) -> list[list[float]]:
        # fastembed is sync but fast (ONNX on CPU)
        embeddings = list(self._model.embed(texts))
        return [e.tolist() for e in embeddings]
