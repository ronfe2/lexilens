
from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field

from app.models.interests import InterestTopicPayload


class AnalyzeRequest(BaseModel):
    word: str = Field(..., description="Selected word or phrase to analyze")
    context: str = Field(..., description="Full sentence or paragraph containing the word")
    page_type: Optional[str] = Field(
        None,
        description="Type of page: 'news', 'academic', 'social', 'email', etc."
    )
    english_level: Optional[str] = Field(
        None,
        description="Learner CEFR level, e.g. 'B1'"
    )
    url: Optional[str] = Field(
        None,
        description="Full URL of the page where LexiLens was triggered",
    )
    learning_history: Optional[List[str]] = Field(
        default_factory=list,
        description="List of previously looked-up words for personalization"
    )
    favorite_words: Optional[List[str]] = Field(
        default_factory=list,
        description="Subset of learning words explicitly marked as favorites.",
    )
    interests: Optional[list[InterestTopicPayload]] = Field(
        default_factory=list,
        description="Current interest topics used to personalize explanations",
    )
    blocked_titles: Optional[list[str]] = Field(
        default_factory=list,
        description="Interest titles that should NOT be mentioned",
    )

    class Config:
        json_schema_extra = {
            "example": {
                "word": "precarious",
                "context": "The economic situation remains precarious despite recent improvements.",
                "page_type": "news",
                "url": "https://example.com/article",
                "english_level": "B1",
                "learning_history": ["strategy", "implement"],
                "favorite_words": ["strategy"],
                "interests": [],
                "blocked_titles": [],
            }
        }


class PronunciationRequest(BaseModel):
    word: str = Field(..., description="Word to get pronunciation for")


class LearningHistoryRequest(BaseModel):
    words: list[str] = Field(..., description="List of words to add to learning history")


class LexicalImageRequest(BaseModel):
    base_word: str = Field(..., description="Main word in the lexical map")
    related_word: str = Field(..., description="Selected related word from the lexical map")
