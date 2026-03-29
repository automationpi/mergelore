"""Exponential backoff retry decorator."""

from __future__ import annotations

import asyncio
import functools
import logging
from typing import Any, Callable

logger = logging.getLogger("mergelore-indexer")


def with_retry(max_retries: int = 3, base_delay: float = 1.0) -> Callable:
    """Retry async functions with exponential backoff."""

    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        async def wrapper(*args: Any, **kwargs: Any) -> Any:
            for attempt in range(max_retries + 1):
                try:
                    return await func(*args, **kwargs)
                except Exception as e:
                    if attempt == max_retries:
                        raise
                    delay = base_delay * (2**attempt)
                    logger.warning(
                        "Retry %d/%d for %s after error: %s (waiting %.1fs)",
                        attempt + 1,
                        max_retries,
                        func.__name__,
                        str(e),
                        delay,
                    )
                    await asyncio.sleep(delay)

        return wrapper

    return decorator
