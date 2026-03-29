"""End-to-end local test: extract → chunk → embed (mock) → upsert to in-memory Qdrant → query from Action provider."""


import pytest
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct, PayloadSchemaType

from mergelore_indexer.chunk import chunk_text


# --- Test the full pipeline with in-memory Qdrant ---


@pytest.fixture
def qdrant_memory():
    """Create an in-memory Qdrant client for testing."""
    client = QdrantClient(":memory:")
    return client


def test_full_indexing_pipeline(qdrant_memory):
    """Simulate: PR merged → chunk → embed (mock vectors) → upsert → query by file filter."""

    collection = "mergelore-test-repo"
    dimension = 4  # tiny vectors for testing

    # 1. Create collection
    qdrant_memory.create_collection(
        collection_name=collection,
        vectors_config=VectorParams(size=dimension, distance=Distance.COSINE),
    )
    qdrant_memory.create_payload_index(
        collection_name=collection,
        field_name="files_touched",
        field_schema=PayloadSchemaType.KEYWORD,
    )

    # 2. Simulate PR content
    pr_text = """PR #42: Remove legacy auth middleware

We're removing the session-based auth middleware because legal flagged it
for storing session tokens in a way that doesn't meet compliance requirements.

The new approach uses JWT tokens with short expiry.

Files changed: src/auth/middleware.ts, src/auth/session.ts, src/config.ts

Review comment: Make sure to update the docs about the new auth flow.
Review comment: The session cleanup migration should run before this ships.
"""

    # 3. Chunk
    chunks = chunk_text(pr_text)
    assert len(chunks) >= 1

    # 4. Mock embeddings (just random vectors)
    import random
    random.seed(42)
    vectors = [[random.random() for _ in range(dimension)] for _ in chunks]

    # 5. Build payloads
    files = ["src/auth/middleware.ts", "src/auth/session.ts", "src/config.ts"]
    points = []
    for i, (chunk, vector) in enumerate(zip(chunks, vectors)):
        import uuid
        point_id = str(uuid.uuid5(
            uuid.UUID("a1b2c3d4-e5f6-7890-abcd-ef1234567890"),
            f"{collection}/42/{i}",
        ))
        points.append(PointStruct(
            id=point_id,
            vector=vector,
            payload={
                "pr_number": 42,
                "pr_title": "Remove legacy auth middleware",
                "pr_url": "https://github.com/test/repo/pull/42",
                "merged_at": "2026-01-15T10:00:00Z",
                "author": "alice",
                "files_touched": files,
                "chunk_text": chunk.text,
                "chunk_index": chunk.index,
                "total_chunks": chunk.total,
            },
        ))

    # 6. Upsert
    qdrant_memory.upsert(collection_name=collection, points=points)

    # 7. Query by file filter (same way the Action does it)
    from qdrant_client.models import Filter, FieldCondition, MatchValue

    query_files = ["src/auth/middleware.ts", "src/config.ts"]
    result = qdrant_memory.scroll(
        collection_name=collection,
        scroll_filter=Filter(
            should=[
                FieldCondition(key="files_touched", match=MatchValue(value=f))
                for f in query_files
            ],
        ),
        limit=100,
        with_payload=True,
        with_vectors=False,
    )

    points_found, _ = result
    assert len(points_found) >= 1

    # 8. Verify payload
    payload = points_found[0].payload
    assert payload["pr_number"] == 42
    assert payload["pr_title"] == "Remove legacy auth middleware"
    assert "src/auth/middleware.ts" in payload["files_touched"]
    assert payload["author"] == "alice"

    # 9. Deduplicate by PR (same logic as qdrant.ts Action provider)
    by_pr = {}
    for p in points_found:
        pr_num = p.payload["pr_number"]
        if pr_num not in by_pr:
            by_pr[pr_num] = []
        by_pr[pr_num].append(p)

    assert len(by_pr) == 1  # only PR #42
    assert 42 in by_pr

    # 10. Compute relevance score
    current_files = set(query_files)
    all_files = set()
    for p in by_pr[42]:
        all_files.update(p.payload["files_touched"])
    overlap = all_files & current_files
    score = len(overlap) / len(current_files)
    assert score == 1.0  # both query files are in files_touched

    print("\n✅ Full pipeline test passed!")
    print(f"   Chunks indexed: {len(chunks)}")
    print(f"   Points found: {len(points_found)}")
    print(f"   Unique PRs: {len(by_pr)}")
    print(f"   Relevance score: {score}")
    print(f"   PR title: {payload['pr_title']}")


def test_multiple_prs_ranked_by_relevance(qdrant_memory):
    """Index 3 PRs, query for files, verify ranking by overlap."""

    collection = "mergelore-test-ranking"
    dimension = 4

    qdrant_memory.create_collection(
        collection_name=collection,
        vectors_config=VectorParams(size=dimension, distance=Distance.COSINE),
    )
    qdrant_memory.create_payload_index(
        collection_name=collection,
        field_name="files_touched",
        field_schema=PayloadSchemaType.KEYWORD,
    )

    # PR #10: touches auth only
    # PR #11: touches auth + config
    # PR #12: touches unrelated files
    prs = [
        (10, "Fix auth bug", ["src/auth.ts"]),
        (11, "Refactor auth and config", ["src/auth.ts", "src/config.ts"]),
        (12, "Update README", ["README.md"]),
    ]

    import uuid
    import random
    random.seed(99)
    for pr_num, title, files in prs:
        point_id = str(uuid.uuid5(
            uuid.UUID("a1b2c3d4-e5f6-7890-abcd-ef1234567890"),
            f"{collection}/{pr_num}/0",
        ))
        qdrant_memory.upsert(
            collection_name=collection,
            points=[PointStruct(
                id=point_id,
                vector=[random.random() for _ in range(dimension)],
                payload={
                    "pr_number": pr_num,
                    "pr_title": title,
                    "pr_url": f"https://github.com/test/repo/pull/{pr_num}",
                    "merged_at": f"2026-01-{pr_num}",
                    "author": "bob",
                    "files_touched": files,
                    "chunk_text": f"Content of {title}",
                    "chunk_index": 0,
                    "total_chunks": 1,
                },
            )],
        )

    # Query for files that overlap with PR #10 and #11
    from qdrant_client.models import Filter, FieldCondition, MatchValue

    query_files = ["src/auth.ts", "src/config.ts"]
    result, _ = qdrant_memory.scroll(
        collection_name=collection,
        scroll_filter=Filter(
            should=[
                FieldCondition(key="files_touched", match=MatchValue(value=f))
                for f in query_files
            ],
        ),
        limit=100,
        with_payload=True,
        with_vectors=False,
    )

    # Should find PR #10 and #11, NOT #12
    pr_numbers = {p.payload["pr_number"] for p in result}
    assert 10 in pr_numbers
    assert 11 in pr_numbers
    assert 12 not in pr_numbers

    # Rank by relevance
    current_files = set(query_files)
    scored = []
    for p in result:
        overlap = set(p.payload["files_touched"]) & current_files
        score = len(overlap) / len(current_files)
        scored.append((p.payload["pr_number"], score))

    scored.sort(key=lambda x: x[1], reverse=True)

    # PR #11 (2/2 = 1.0) should rank above PR #10 (1/2 = 0.5)
    assert scored[0] == (11, 1.0)
    assert scored[1] == (10, 0.5)

    print("\n✅ Ranking test passed!")
    print(f"   Results: {scored}")
