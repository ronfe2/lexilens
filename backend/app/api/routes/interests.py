import logging

from fastapi import APIRouter

from app.models.interests import (
    InterestFromUsageRequest,
    InterestFromUsageResponse,
)
from app.services.llm_orchestrator import llm_orchestrator

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/interests/from-usage", response_model=InterestFromUsageResponse)
async def summarize_interests_from_usage(
    request: InterestFromUsageRequest,
) -> InterestFromUsageResponse:
    """
    Summarize or update interest topics based on the latest LexiLens usage.

    The backend is stateless: the extension sends the current topics and
    receives an updated full list after considering the latest usage.
    """
    logger.info(
        "Summarizing interests from usage: word='%s', url='%s', page_type='%s'",
        request.word,
        request.url,
        request.page_type,
    )

    topics = await llm_orchestrator.summarize_interests_from_usage(
        word=request.word,
        context=request.context,
        page_type=request.page_type,
        url=request.url,
        existing_topics=request.existing_topics,
        blocked_titles=request.blocked_titles,
    )

    return InterestFromUsageResponse(topics=topics)

