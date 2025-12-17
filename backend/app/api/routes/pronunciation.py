import logging
import time
from typing import Dict, Tuple

import httpx
from fastapi import APIRouter, HTTPException

from app.models.response import PronunciationResponse

logger = logging.getLogger(__name__)

router = APIRouter()

# Simple in-memory cache to avoid hammering the external dictionary API.
# This keeps pronunciation lookup "best-effort" and prevents rate limiting
# from degrading the overall experience.
CACHE_TTL_SECONDS = 60 * 60  # 1 hour
_pronunciation_cache: Dict[str, Tuple[float, PronunciationResponse]] = {}


@router.get("/pronunciation/{word}")
async def get_pronunciation(word: str) -> PronunciationResponse:
    logger.info(f"Getting pronunciation for: '{word}'")

    cache_key = word.lower()
    now = time.time()

    # Serve from cache when available and fresh
    cached = _pronunciation_cache.get(cache_key)
    if cached:
        ts, cached_value = cached
        if now - ts < CACHE_TTL_SECONDS:
            return cached_value

    try:
        # Call external dictionary API with a short timeout. We intentionally keep this
        # separate from the core LLM flow so that rate limiting or failures here
        # degrade gracefully instead of breaking the main experience.
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"https://api.dictionaryapi.dev/api/v2/entries/en/{word}"
            )

            # Handle upstream errors explicitly so we can surface a meaningful
            # status code without turning them into 500s.
            if response.status_code == 404:
                raise HTTPException(
                    status_code=404,
                    detail=f"Pronunciation not found for word: {word}",
                )
            if response.status_code == 429:
                raise HTTPException(
                    status_code=429,
                    detail="Pronunciation service is being rate limited. Please try again later.",
                )
            if response.status_code != 200:
                raise HTTPException(
                    status_code=503,
                    detail="Pronunciation service unavailable",
                )

            data = response.json()

            if not data or not isinstance(data, list) or len(data) == 0:
                raise HTTPException(
                    status_code=404,
                    detail=f"No pronunciation data for word: {word}"
                )

            entry = data[0]
            phonetics = entry.get("phonetics", [])

            ipa = None
            audio_url = None

            for phonetic in phonetics:
                if not ipa and phonetic.get("text"):
                    ipa = phonetic["text"]
                if not audio_url and phonetic.get("audio"):
                    audio_url = phonetic["audio"]
                if ipa and audio_url:
                    break

            if not ipa:
                ipa = entry.get("phonetic", "N/A")

            result = PronunciationResponse(
                word=word,
                ipa=ipa,
                audio_url=audio_url
            )

            # Store fresh result in cache
            _pronunciation_cache[cache_key] = (now, result)
            return result

    except HTTPException:
        # Re-raise FastAPI HTTP exceptions so they are not wrapped as 500s.
        raise
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Pronunciation API timeout")
    except httpx.HTTPError as e:
        logger.error(f"HTTP error getting pronunciation: {e}")
        raise HTTPException(status_code=503, detail="Pronunciation service unavailable")
    except Exception as e:
        logger.error(f"Error getting pronunciation: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
