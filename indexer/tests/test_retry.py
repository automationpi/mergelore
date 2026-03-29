"""Tests for retry decorator."""

import pytest

from mergelore_indexer.retry import with_retry


async def test_succeeds_on_first_try():
    call_count = 0

    @with_retry(max_retries=3, base_delay=0.01)
    async def succeed():
        nonlocal call_count
        call_count += 1
        return "ok"

    result = await succeed()
    assert result == "ok"
    assert call_count == 1


async def test_succeeds_on_second_try():
    call_count = 0

    @with_retry(max_retries=3, base_delay=0.01)
    async def fail_then_succeed():
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            raise ValueError("transient")
        return "ok"

    result = await fail_then_succeed()
    assert result == "ok"
    assert call_count == 2


async def test_raises_after_max_retries():
    call_count = 0

    @with_retry(max_retries=2, base_delay=0.01)
    async def always_fail():
        nonlocal call_count
        call_count += 1
        raise ValueError("permanent")

    with pytest.raises(ValueError, match="permanent"):
        await always_fail()

    # 1 initial + 2 retries = 3 calls
    assert call_count == 3
