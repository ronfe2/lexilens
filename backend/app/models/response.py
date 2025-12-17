
from pydantic import BaseModel, Field


class LiveContext(BaseModel):
    source: str = Field(..., description="Source type: 'twitter', 'news', 'academic'")
    text: str = Field(..., description="Example sentence from that source")
    icon: str | None = Field(None, description="Icon identifier for UI")


class CommonMistake(BaseModel):
    wrong: str = Field(..., description="Incorrect usage example")
    why: str = Field(..., description="Explanation of why it's wrong")
    correct: str = Field(..., description="Corrected version")


class RelatedWord(BaseModel):
    word: str = Field(..., description="Related word or phrase")
    relationship: str = Field(..., description="Type of relationship: synonym, antonym, etc.")
    difference: str = Field(..., description="Key difference from the queried word")
    when_to_use: str = Field(..., description="When to use this word vs the queried word")


class Layer1Response(BaseModel):
    content: str = Field(..., description="Cobuild-style behavior pattern definition")


class Layer2Response(BaseModel):
    contexts: list[LiveContext] = Field(
        ..., description="3 example contexts from different sources"
    )


class Layer3Response(BaseModel):
    mistakes: list[CommonMistake] = Field(..., description="Common mistakes made with this word")


class Layer4Response(BaseModel):
    related_words: list[RelatedWord] = Field(
        ..., description="Related words for cognitive scaffolding"
    )
    personalized: str | None = Field(
        None,
        description="Personalized message based on learning history"
    )


class AnalyzeResponse(BaseModel):
    layer1: Layer1Response
    layer2: Layer2Response
    layer3: Layer3Response
    layer4: Layer4Response


class PronunciationResponse(BaseModel):
    word: str
    ipa: str = Field(..., description="IPA notation")
    audio_url: str | None = Field(None, description="URL to audio pronunciation")


class ErrorResponse(BaseModel):
    error: str
    detail: str | None = None
    code: str | None = None
