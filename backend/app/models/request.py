
from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field


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
    learning_history: Optional[List[str]] = Field(
        default_factory=list,
        description="List of previously looked-up words for personalization"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "word": "precarious",
            "context": "The economic situation remains precarious despite recent improvements.",
            "page_type": "news",
            "english_level": "B1",
            "learning_history": ["strategy", "implement"]
        }
    }


class PronunciationRequest(BaseModel):
    word: str = Field(..., description="Word to get pronunciation for")


class LearningHistoryRequest(BaseModel):
    words: list[str] = Field(..., description="List of words to add to learning history")


class LexicalImageRequest(BaseModel):
    base_word: str = Field(..., description="Main word in the lexical map")
    related_word: str = Field(..., description="Selected related word from the lexical map")
