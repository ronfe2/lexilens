import logging

from fastapi import APIRouter
from sse_starlette.sse import EventSourceResponse

from app.models.request import AnalyzeRequest
from app.services.llm_orchestrator import llm_orchestrator
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
