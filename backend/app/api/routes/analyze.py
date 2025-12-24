import logging

from fastapi import APIRouter, HTTPException
from sse_starlette.sse import EventSourceResponse

from app.models.request import AnalyzeRequest, CommonMistakesRequest
from app.models.response import Layer3Response
from app.services.llm_orchestrator import llm_orchestrator
from app.utils.error_handling import (
    APIConnectionError,
    OpenRouterError,
    RateLimitError,
)
from app.utils.streaming import stream_sse_events

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/analyze")
async def analyze_word(request: AnalyzeRequest):
    logger.info(f"Analyzing word: '{request.word}' with context length: {len(request.context)}")

    async def event_generator():
        async for sse_data in stream_sse_events(llm_orchestrator.analyze_streaming(request)):
            yield sse_data

    return EventSourceResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        }
    )


@router.post("/analyze/mistakes", response_model=Layer3Response)
async def generate_common_mistakes(
    request: CommonMistakesRequest,
) -> Layer3Response:
    """
    Generate Common Mistakes (Layer 3) for a given word and context.

    This endpoint mirrors the layer3 part of `/api/analyze` but returns a
    JSON response instead of streaming SSE events so the frontend can
    lazily load this data when needed.
    """
    logger.info(
        "Generating common mistakes for word='%s' (context length=%d, level=%s)",
        request.word,
        len(request.context or ""),
        request.english_level,
    )

    try:
        return await llm_orchestrator.generate_layer3(
            word=request.word,
            context=request.context,
            english_level=request.english_level,
        )
    except RateLimitError as e:
        logger.warning("Common mistakes generation rate limited: %s", e)
        raise HTTPException(
            status_code=429,
            detail="Common mistakes generation is being rate limited. Please try again later.",
        )
    except APIConnectionError as e:
        logger.error("Common mistakes generation connection error: %s", e)
        raise HTTPException(
            status_code=503,
            detail="Common mistakes service is temporarily unavailable.",
        )
    except OpenRouterError as e:
        logger.error("Common mistakes generation failed: %s", e)
        raise HTTPException(
            status_code=getattr(e, "status_code", 500) or 500,
            detail=getattr(e, "message", "Common mistakes generation failed."),
        )
    except Exception as e:  # noqa: BLE001
        logger.exception("Unexpected error during common mistakes generation: %s", e)
        raise HTTPException(
            status_code=500,
            detail="Unexpected error while generating common mistakes.",
        )
