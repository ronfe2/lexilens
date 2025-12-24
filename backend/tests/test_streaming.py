from __future__ import annotations

import asyncio
import json

import pytest

from app.models.request import AnalyzeRequest
from app.models.response import (
    CommonMistake,
    Layer2Response,
    Layer3Response,
    Layer4Response,
    LiveContext,
    RelatedWord,
)
from app.services.llm_orchestrator import LLMOrchestrator
from app.utils.streaming import stream_sse_events


@pytest.mark.asyncio
async def test_stream_sse_events_normalizes_events_to_json_strings():
    async def generator():
        yield {"event": "layer1_chunk", "data": {"content": "hello"}}
        yield {"event": "done", "data": {}}

    seen_events = []

    async for event in stream_sse_events(generator()):
        seen_events.append(event)

    assert len(seen_events) == 2

    first, second = seen_events

    # Events should be dicts that EventSourceResponse can consume directly
    assert isinstance(first, dict)
    assert first["event"] == "layer1_chunk"
    assert json.loads(first["data"]) == {"content": "hello"}

    assert isinstance(second, dict)
    assert second["event"] == "done"
    assert json.loads(second["data"]) == {}


class _TestOrchestrator(LLMOrchestrator):
    async def generate_layer1_stream(
        self,
        word: str,
        context: str,
        english_level: str | None = None,
    ):
        # Single chunk to simplify assertions in tests.
        yield "layer1 content"

    async def generate_layer2(self, word: str, context: str) -> Layer2Response:
        return Layer2Response(
            contexts=[
                LiveContext(source="test", text="layer2", icon=None),
            ]
        )

    async def generate_layer3(
        self,
        word: str,
        context: str,
        english_level: str | None = None,
    ) -> Layer3Response:
        return Layer3Response(
            mistakes=[
                CommonMistake(
                    wrong="wrong",
                    why="why",
                    correct="correct",
                )
            ]
        )

    async def generate_layer4(
        self,
        word: str,
        context: str,
        learning_history: list[str] | None = None,
        english_level: str | None = None,
        interests=None,
        blocked_titles=None,
        favorite_words=None,
    ) -> Layer4Response:
        return Layer4Response(
            related_words=[
                RelatedWord(
                    word="related",
                    relationship="synonym",
                    difference="diff",
                    when_to_use="when",
                )
            ],
            personalized="personalized",
        )

    async def generate_layer4_personalized_stream(
        self,
        word: str,
        context: str,
        learning_history: list[str] | None = None,
        english_level: str | None = None,
        interests=None,
        blocked_titles=None,
        favorite_words=None,
    ):
        # Emit a single, small chunk to keep tests deterministic and avoid
        # hitting the real OpenRouter client during unit tests.
        yield "personalized"


class _OrderedCompletionOrchestrator(_TestOrchestrator):
    async def generate_layer2(self, word: str, context: str) -> Layer2Response:
        await asyncio.sleep(0.05)
        return await super().generate_layer2(word, context)

    async def generate_layer3(
        self,
        word: str,
        context: str,
        english_level: str | None = None,
    ) -> Layer3Response:
        await asyncio.sleep(0.02)
        return await super().generate_layer3(word, context, english_level)

    async def generate_layer4(
        self,
        word: str,
        context: str,
        learning_history: list[str] | None = None,
        english_level: str | None = None,
        interests=None,
        blocked_titles=None,
        favorite_words=None,
    ) -> Layer4Response:
        await asyncio.sleep(0.01)
        return await super().generate_layer4(
            word,
            context,
            learning_history,
            english_level,
            interests,
            blocked_titles,
            favorite_words,
        )


@pytest.mark.asyncio
async def test_analyze_streaming_respects_requested_layers_selection():
    orchestrator = _TestOrchestrator()
    base_request = {
        "word": "test",
        "context": "This is a test sentence.",
    }

    # When layers is omitted, default to [2,3,4].
    request_all = AnalyzeRequest(**base_request)
    events_all = [event async for event in orchestrator.analyze_streaming(request_all)]
    event_names_all = [event["event"] for event in events_all]

    assert "layer1_chunk" in event_names_all
    assert "layer1_complete" in event_names_all
    assert "layer2" in event_names_all
    assert "layer3" in event_names_all
    assert "layer4" in event_names_all
    assert "done" == event_names_all[-1]

    # When layers only includes 2 and 4, layer3 should not be generated/emitted.
    request_24 = AnalyzeRequest(**base_request, layers=[2, 4])
    events_24 = [event async for event in orchestrator.analyze_streaming(request_24)]
    event_names_24 = [event["event"] for event in events_24]

    assert "layer2" in event_names_24
    assert "layer4" in event_names_24
    assert "layer3" not in event_names_24

    # An explicit empty list should behave like None and request all layers.
    request_empty = AnalyzeRequest(**base_request, layers=[])
    events_empty = [
        event async for event in orchestrator.analyze_streaming(request_empty)
    ]
    event_names_empty = [event["event"] for event in events_empty]

    assert "layer2" in event_names_empty
    assert "layer3" in event_names_empty
    assert "layer4" in event_names_empty


@pytest.mark.asyncio
async def test_analyze_streaming_emits_layers_in_completion_order():
    orchestrator = _OrderedCompletionOrchestrator()
    request = AnalyzeRequest(
        word="test",
        context="This is a test sentence.",
    )

    events = [event async for event in orchestrator.analyze_streaming(request)]
    event_names = [event["event"] for event in events]

    # Layer 1 should always stream first.
    assert event_names[0] == "layer1_chunk"
    assert event_names[1] == "layer1_complete"

    # Subsequent layer events should be emitted in the order their tasks finish:
    # layer4 (fastest) -> layer3 -> layer2 (slowest).
    later_layer_events = [
        name for name in event_names if name in {"layer2", "layer3", "layer4"}
    ]
    assert later_layer_events == ["layer4", "layer3", "layer2"]

    # Final event should still be the done sentinel.
    assert event_names[-1] == "done"
