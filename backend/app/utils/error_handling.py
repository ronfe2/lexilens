import asyncio
import logging
from collections.abc import Awaitable, Callable
from functools import wraps
from typing import Any, TypeVar

logger = logging.getLogger(__name__)

T = TypeVar("T")


class OpenRouterError(Exception):
    def __init__(self, message: str, status_code: int = 500, detail: Any = None):
        self.message = message
        self.status_code = status_code
        self.detail = detail
        super().__init__(self.message)


class RateLimitError(OpenRouterError):
    def __init__(self, message: str = "Rate limit exceeded", retry_after: int = 60):
        super().__init__(message, status_code=429)
        self.retry_after = retry_after


class APIConnectionError(OpenRouterError):
    def __init__(self, message: str = "Failed to connect to API"):
        super().__init__(message, status_code=503)


async def retry_with_exponential_backoff(
    func: Callable[..., Awaitable[T]],
    *args: Any,
    max_retries: int = 3,
    initial_delay: float = 1.0,
    exponential_base: float = 2.0,
    jitter: bool = True,
    **kwargs: Any,
) -> T:
    """
    Generic async retry helper with exponential backoff.

    `func` is an async callable; `*args`/`**kwargs` are forwarded to it on each attempt.
    The configuration parameters are passed as keyword-only to avoid interfering
    with positional arguments such as `self` on bound methods.
    """
    delay = initial_delay

    for attempt in range(max_retries):
        try:
            return await func(*args, **kwargs)
        except RateLimitError as e:
            if attempt == max_retries - 1:
                raise
            # Respect server-provided retry-after when present
            delay = e.retry_after
            logger.warning(
                f"Rate limit hit, retrying after {delay}s "
                f"(attempt {attempt + 1}/{max_retries})"
            )
        except APIConnectionError as e:
            if attempt == max_retries - 1:
                raise
            logger.warning(
                f"Connection error, retrying (attempt {attempt + 1}/{max_retries}): {e}"
            )
        except Exception as e:
            if attempt == max_retries - 1:
                raise
            logger.error(
                f"Unexpected error, retrying (attempt {attempt + 1}/{max_retries}): {e}"
            )

        await asyncio.sleep(delay)

        if jitter:
            import random

            delay = delay * exponential_base * (0.5 + random.random() * 0.5)
        else:
            delay = delay * exponential_base

    raise OpenRouterError("Max retries exceeded")


def async_retry(max_retries: int = 3, initial_delay: float = 1.0):
    """
    Decorator to add retry-with-backoff behavior to async functions.

    Works correctly with bound methods (first arg `self`) by keeping all
    positional arguments in `*args` and passing retry config as keywords.
    """

    def decorator(func: Callable[..., Awaitable[T]]) -> Callable[..., Awaitable[T]]:
        @wraps(func)
        async def wrapper(*args: Any, **kwargs: Any) -> T:
            return await retry_with_exponential_backoff(
                func,
                *args,
                max_retries=max_retries,
                initial_delay=initial_delay,
                **kwargs,
            )

        return wrapper

    return decorator
