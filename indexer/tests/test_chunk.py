"""Tests for text chunking."""


from mergelore_indexer.chunk import chunk_text, CHUNK_SIZE, OVERLAP, ENCODING


def test_empty_string_returns_empty():
    assert chunk_text("") == []
    assert chunk_text("   ") == []


def test_short_text_returns_single_chunk():
    text = "This is a short text."
    chunks = chunk_text(text)
    assert len(chunks) == 1
    assert chunks[0].index == 0
    assert chunks[0].total == 1
    assert chunks[0].text == text


def test_exact_chunk_size_returns_single_chunk():
    # Create text that is exactly CHUNK_SIZE tokens
    tokens = list(range(100, 100 + CHUNK_SIZE))
    text = ENCODING.decode(tokens)
    chunks = chunk_text(text)
    assert len(chunks) == 1


def test_chunks_have_correct_overlap():
    # Create text longer than one chunk
    token_count = CHUNK_SIZE * 2
    tokens = list(range(100, 100 + token_count))
    text = ENCODING.decode(tokens)

    chunks = chunk_text(text)
    assert len(chunks) >= 2

    # Verify overlap: last OVERLAP tokens of chunk 0 == first OVERLAP tokens of chunk 1
    tokens_0 = ENCODING.encode(chunks[0].text)
    tokens_1 = ENCODING.encode(chunks[1].text)
    assert tokens_0[-OVERLAP:] == tokens_1[:OVERLAP]


def test_chunk_indices_are_sequential():
    tokens = list(range(100, 100 + CHUNK_SIZE * 3))
    text = ENCODING.decode(tokens)
    chunks = chunk_text(text)

    for i, chunk in enumerate(chunks):
        assert chunk.index == i
        assert chunk.total == len(chunks)


def test_all_content_is_preserved():
    text = "The quick brown fox " * 200  # Long enough for multiple chunks
    chunks = chunk_text(text)
    assert len(chunks) > 1

    # First chunk starts with original text
    assert chunks[0].text.startswith("The quick brown fox")
