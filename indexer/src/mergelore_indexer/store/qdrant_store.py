"""Qdrant vector store implementation."""

from __future__ import annotations

import uuid
from typing import Any

from qdrant_client import AsyncQdrantClient
from qdrant_client.models import (
    Distance,
    PointStruct,
    VectorParams,
    PayloadSchemaType,
)

from .interface import ChunkPayload
from ..metrics import emit_event


NAMESPACE_MERGELORE = uuid.UUID("a1b2c3d4-e5f6-7890-abcd-ef1234567890")


class QdrantStore:
    def __init__(
        self,
        url: str,
        collection_name: str,
        api_key: str | None = None,
    ) -> None:
        self._client = AsyncQdrantClient(url=url, api_key=api_key)
        self._collection = collection_name

    async def ensure_collection(self, dimension: int) -> None:
        collections = await self._client.get_collections()
        existing = [c.name for c in collections.collections]

        if self._collection in existing:
            # Check if dimension matches - recreate if embedding model changed
            info = await self._client.get_collection(self._collection)
            current_dim = info.config.params.vectors.size
            if current_dim != dimension:
                emit_event(
                    "collection_dimension_mismatch",
                    collection=self._collection,
                    expected=dimension,
                    actual=current_dim,
                )
                await self._client.delete_collection(self._collection)
                existing.remove(self._collection)

        if self._collection not in existing:
            await self._client.create_collection(
                collection_name=self._collection,
                vectors_config=VectorParams(size=dimension, distance=Distance.COSINE),
            )
            emit_event("collection_created", collection=self._collection, dimension=dimension)

        # Ensure payload index on files_touched for filter queries
        await self._client.create_payload_index(
            collection_name=self._collection,
            field_name="files_touched",
            field_schema=PayloadSchemaType.KEYWORD,
        )

    async def upsert(
        self, chunks: list[ChunkPayload], vectors: list[list[float]]
    ) -> int:
        points: list[Any] = []
        for chunk, vector in zip(chunks, vectors):
            point_id = str(
                uuid.uuid5(
                    NAMESPACE_MERGELORE,
                    f"{self._collection}/{chunk.pr_number}/{chunk.chunk_index}",
                )
            )
            points.append(
                PointStruct(
                    id=point_id,
                    vector=vector,
                    payload={
                        "pr_number": chunk.pr_number,
                        "pr_title": chunk.pr_title,
                        "pr_url": chunk.pr_url,
                        "merged_at": chunk.merged_at,
                        "author": chunk.author,
                        "files_touched": chunk.files_touched,
                        "chunk_text": chunk.chunk_text,
                        "chunk_index": chunk.chunk_index,
                        "total_chunks": chunk.total_chunks,
                    },
                )
            )

        await self._client.upsert(
            collection_name=self._collection,
            points=points,
        )

        emit_event(
            "chunks_upserted",
            collection=self._collection,
            count=len(points),
            pr_number=chunks[0].pr_number if chunks else 0,
        )
        return len(points)
