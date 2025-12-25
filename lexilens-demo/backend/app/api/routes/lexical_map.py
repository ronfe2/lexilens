import logging
import time

from fastapi import APIRouter, HTTPException

from app.models.request import LexicalImageRequest, LexicalMapTextRequest
from app.models.response import LexicalImageResponse, Layer4Response
from app.prompt_config import PROMPT_CONFIG
from app.services.llm_orchestrator import llm_orchestrator
from app.services.openrouter import openrouter_client
from app.utils.error_handling import (
    APIConnectionError,
    OpenRouterError,
    RateLimitError,
)

logger = logging.getLogger(__name__)

router = APIRouter()

# Simple in-memory cache to avoid regenerating the same image repeatedly in
# a short period. This keeps the feature responsive while being gentle on
# the image model quota. Cache keys are lower-cased so that different
# capitalizations of the same word pair share a single cached image.
CACHE_TTL_SECONDS = 60 * 60 * 6  # 6 hours
_lexical_image_cache: dict[tuple[str, str], tuple[float, LexicalImageResponse]] = {}


@router.post("/lexical-map/image", response_model=LexicalImageResponse)
async def generate_lexical_image(
    payload: LexicalImageRequest,
) -> LexicalImageResponse:
    """
    Generate an XKCD-style visual explanation for the difference between two
    related words in the lexical map.
    """
    base_word = (payload.base_word or "").strip()
    related_word = (payload.related_word or "").strip()

    if not base_word or not related_word:
        raise HTTPException(
            status_code=400,
            detail="Both base_word and related_word are required.",
        )

    cache_key = (base_word.lower(), related_word.lower())
    now = time.time()

    cached = _lexical_image_cache.get(cache_key)
    if cached:
        ts, cached_value = cached
        if now - ts < CACHE_TTL_SECONDS:
            return cached_value
    prompt_template = PROMPT_CONFIG["lexical_image"]["prompt_template"]
    prompt = prompt_template.format(base_word=base_word, related_word=related_word)

    try:
        image_url = await openrouter_client.generate_image(prompt=prompt)
    except RateLimitError as e:
        logger.warning("Lexical image generation rate limited: %s", e)
        raise HTTPException(
            status_code=429,
            detail="Image generation is being rate limited. Please try again later.",
        )
    except APIConnectionError as e:
        logger.error("Lexical image generation connection error: %s", e)
        raise HTTPException(
            status_code=503,
            detail="Image generation service is temporarily unavailable.",
        )
    except OpenRouterError as e:
        logger.error("Lexical image generation failed: %s", e)
        raise HTTPException(
            status_code=getattr(e, "status_code", 500) or 500,
            detail=getattr(e, "message", "Image generation failed."),
        )
    except Exception as e:  # noqa: BLE001
        logger.exception("Unexpected error during lexical image generation: %s", e)
        raise HTTPException(
            status_code=500,
            detail="Unexpected error while generating image.",
        )

    response = LexicalImageResponse(image_url=image_url, prompt=prompt)
    _lexical_image_cache[cache_key] = (now, response)

    return response


@router.post("/lexical-map/text", response_model=Layer4Response)
async def generate_lexical_map_text(
    request: LexicalMapTextRequest,
) -> Layer4Response:
    """
    Generate Lexical Map text data (Layer 4) for a given word and context.

    This reuses the same orchestration as `/api/analyze` but exposes a
    JSON endpoint so the frontend can lazily load related words and
    personalized coaching text.
    """
    logger.info(
        "Generating lexical map text for word='%s' (context length=%d, level=%s)",
        request.word,
        len(request.context or ""),
        request.english_level,
    )

    try:
        return await llm_orchestrator.generate_layer4(
            word=request.word,
            context=request.context,
            learning_history=request.learning_history,
            english_level=request.english_level,
            interests=request.interests,
            blocked_titles=request.blocked_titles,
            favorite_words=request.favorite_words,
        )
    except RateLimitError as e:
        logger.warning("Lexical map text generation rate limited: %s", e)
        raise HTTPException(
            status_code=429,
            detail="Lexical map text generation is being rate limited. Please try again later.",
        )
    except APIConnectionError as e:
        logger.error("Lexical map text generation connection error: %s", e)
        raise HTTPException(
            status_code=503,
            detail="Lexical map text service is temporarily unavailable.",
        )
    except OpenRouterError as e:
        logger.error("Lexical map text generation failed: %s", e)
        raise HTTPException(
            status_code=getattr(e, "status_code", 500) or 500,
            detail=getattr(e, "message", "Lexical map text generation failed."),
        )
    except Exception as e:  # noqa: BLE001
        logger.exception("Unexpected error during lexical map text generation: %s", e)
        raise HTTPException(
            status_code=500,
            detail="Unexpected error while generating lexical map text.",
        )
