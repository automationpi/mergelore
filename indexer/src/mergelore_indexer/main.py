"""CLI entry point for the mergelore indexer."""

from __future__ import annotations

import asyncio
import logging
import sys
import time

from github import Github

from .config import load_config
from .extract import find_merged_pr_from_push, extract_pr
from .chunk import chunk_text
from .embed.factory import create_embedding_provider
from .store.qdrant_store import QdrantStore
from .store.interface import ChunkPayload
from .metrics import Metrics, emit_event

logger = logging.getLogger("mergelore-indexer")


async def run() -> int:
    logging.basicConfig(level=logging.INFO, format="%(message)s")

    config = load_config()
    emit_event("indexer_started", embed_model=config.embed_model, repo=config.github_repository)

    # Create providers
    embed_provider = create_embedding_provider(
        model_name=config.embed_model,
        openai_api_key=config.openai_api_key,
        cohere_api_key=config.cohere_api_key,
    )

    collection_name = f"mergelore-{config.owner}-{config.repo}".lower()
    store = QdrantStore(
        url=config.qdrant_url,
        collection_name=collection_name,
        api_key=config.qdrant_api_key,
    )

    # Ensure collection exists with correct dimensions
    await store.ensure_collection(dimension=embed_provider.dimension)

    # Find the merged PR from the push event
    github_client = Github(config.github_token)
    pr_number = find_merged_pr_from_push(
        event_path=config.github_event_path,
        github_client=github_client,
        owner=config.owner,
        repo=config.repo,
    )

    if pr_number is None:
        emit_event("no_merged_pr_found", reason="Push has no associated merged PR")
        return 0

    emit_event("pr_found", pr_number=pr_number)

    # Extract PR content
    pr_doc = extract_pr(github_client, config.owner, config.repo, pr_number)
    emit_event("pr_extracted", pr_number=pr_number, files=len(pr_doc.files))

    # Chunk the content
    text = pr_doc.to_text()
    chunks = chunk_text(text)
    emit_event("chunks_created", pr_number=pr_number, count=len(chunks))

    if not chunks:
        emit_event("no_content_to_index", pr_number=pr_number)
        return 0

    # Embed chunks
    metrics = Metrics()
    chunk_texts = [c.text for c in chunks]

    start = time.time()
    vectors = await embed_provider.embed(chunk_texts)
    metrics.record_embedding_latency(start)

    # Build payloads
    payloads = [
        ChunkPayload(
            pr_number=pr_doc.number,
            pr_title=pr_doc.title,
            pr_url=pr_doc.url,
            merged_at=pr_doc.merged_at,
            author=pr_doc.author,
            files_touched=pr_doc.files,
            chunk_text=c.text,
            chunk_index=c.index,
            total_chunks=c.total,
        )
        for c in chunks
    ]

    # Upsert to Qdrant
    count = await store.upsert(payloads, vectors)
    metrics.documents_indexed = 1
    metrics.chunks_created = count

    metrics.emit_summary()
    return 0


def main() -> None:
    try:
        exit_code = asyncio.run(run())
        sys.exit(exit_code)
    except Exception as e:
        emit_event("indexer_error", error=str(e))
        logger.error("Indexer failed: %s", e)
        sys.exit(1)


if __name__ == "__main__":
    main()
