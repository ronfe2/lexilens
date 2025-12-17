
from pydantic import BaseModel, Field


class AnalyzeRequest(BaseModel):
    word: str = Field(..., description="Selected word or phrase to analyze")
    context: str = Field(..., description="Full sentence or paragraph containing the word")
    page_type: str | None = Field(
        None,
        description="Type of page: 'news', 'academic', 'social', 'email', etc."
    )
    learning_history: list[str] | None = Field(
        default_factory=list,
        description="List of previously looked-up words for personalization"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "word": "precarious",
                "context": "The economic situation remains precarious despite recent improvements.",
                "page_type": "news",
                "learning_history": ["strategy", "implement"]
            }
        }


class PronunciationRequest(BaseModel):
    word: str = Field(..., description="Word to get pronunciation for")


class LearningHistoryRequest(BaseModel):
    words: list[str] = Field(..., description="List of words to add to learning history")
