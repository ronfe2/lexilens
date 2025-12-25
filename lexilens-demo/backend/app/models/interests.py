from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field


class InterestTopicPayload(BaseModel):
    """Minimal interest topic representation shared between backend and extension."""

    id: Optional[str] = Field(
        None,
        description="Stable identifier for the topic (slug-like, no spaces).",
    )
    title: str = Field(..., description="Short title describing the interest topic.")
    summary: str = Field(
        ...,
        description="Short Chinese description of the learner's behavior or interest.",
    )
    urls: List[str] = Field(
        default_factory=list,
        description="Example URLs (pages) that belong to this topic.",
    )


class InterestFromUsageRequest(BaseModel):
    """Request payload for summarizing interests from the latest LexiLens usage."""

    word: str = Field(..., description="Selected word or phrase to analyze.")
    context: str = Field(
        ...,
        description="Full sentence or paragraph where the word was used.",
    )
    page_type: Optional[str] = Field(
        None,
        description="Type of page: 'news', 'academic', 'social', 'email', etc.",
    )
    url: Optional[str] = Field(
        None,
        description="Full URL of the page where LexiLens was triggered.",
    )
    existing_topics: List[InterestTopicPayload] = Field(
        default_factory=list,
        description=(
            "Existing interest topics. The model should decide whether to update one "
            "of these or create a new one."
        ),
    )
    blocked_titles: List[str] = Field(
        default_factory=list,
        description=(
            "Titles that have been explicitly removed by the user and must not be "
            "reintroduced as new topics."
        ),
    )


class InterestFromUsageResponse(BaseModel):
    """Response payload containing the updated list of topics."""

    topics: List[InterestTopicPayload] = Field(
        default_factory=list,
        description="Updated full list of interest topics after applying the latest usage.",
    )

