import pytest

from app.config import settings
from app.models.response import Layer2Response, Layer3Response, Layer4Response, RelatedWord
from app.services.llm_orchestrator import LLMOrchestrator


class _StubClient:
    """Simple stub client that mimics the OpenRouter client interface."""

    def __init__(self, json_response):
        self._json_response = json_response
        self.last_kwargs: dict | None = None

    async def complete_json(self, *args, **kwargs):
        # Record kwargs so tests can assert on model / reasoning selection.
        self.last_kwargs = kwargs
        return self._json_response


@pytest.mark.asyncio
async def test_generate_layer2_ignores_icon_values():
    """Layer 2 should ignore any icon fields returned by the LLM."""
    stub_response = [
        {"source": "twitter", "text": "tweet example", "icon": "twitter"},
        {"source": "news", "text": "news example", "icon": "newspaper"},
        {"source": "academic", "text": "academic example", "icon": "graduation-cap"},
    ]

    orchestrator = LLMOrchestrator()
    orchestrator.client = _StubClient(stub_response)

    result: Layer2Response = await orchestrator.generate_layer2(
        word="test",
        context="This is a test sentence.",
    )

    assert len(result.contexts) == 3
    # All icons should be None regardless of what the model returned.
    assert all(ctx.icon is None for ctx in result.contexts)


@pytest.mark.asyncio
async def test_generate_layer3_respects_max_items():
    """generate_layer3 should honor the max_items limit while keeping at least one."""
    stub_response = [
        {"wrong": "w1", "why": "why1", "correct": "c1"},
        {"wrong": "w2", "why": "why2", "correct": "c2"},
        {"wrong": "w3", "why": "why3", "correct": "c3"},
    ]

    orchestrator = LLMOrchestrator()
    orchestrator.client = _StubClient(stub_response)

    # Default max_items=2
    default_result: Layer3Response = await orchestrator.generate_layer3(
        word="test",
        context="This is a test sentence.",
        english_level=None,
    )
    assert len(default_result.mistakes) == 2

    # Explicitly request a single item.
    single_result: Layer3Response = await orchestrator.generate_layer3(
        word="test",
        context="This is a test sentence.",
        english_level=None,
        max_items=1,
    )
    assert len(single_result.mistakes) == 1

    # Request more than available should cap at the response length.
    capped_result: Layer3Response = await orchestrator.generate_layer3(
        word="test",
        context="This is a test sentence.",
        english_level=None,
        max_items=10,
    )
    assert len(capped_result.mistakes) == 3


@pytest.mark.asyncio
async def test_generate_layer4_caps_related_words_to_five_and_allows_fewer(monkeypatch):
    """Layer 4 orchestration should still cap related words at 5 and allow fewer."""

    async def fake_generate_layer4_candidates(self, word: str, context: str):
        # Pretend the fast model found many candidates; the enrichment stage
        # should still cap final related words based on the LLM response.
        return [
            RelatedWord(
                word=f"candidate{i}",
                relationship="synonym",
                difference="",
                when_to_use="",
            )
            for i in range(7)
        ]

    monkeypatch.setattr(
        LLMOrchestrator,
        "generate_layer4_candidates",
        fake_generate_layer4_candidates,
    )

    # Response with more than 5 related words from the enrichment stage.
    many_related = {
        "related_words": [
            {"word": f"w{i}", "relationship": "synonym", "difference": "d", "when_to_use": "u"}
            for i in range(7)
        ],
        "personalized": "tip",
    }

    orchestrator = LLMOrchestrator()
    orchestrator.client = _StubClient(many_related)

    many_result: Layer4Response = await orchestrator.generate_layer4(
        word="test",
        context="This is a test sentence.",
        learning_history=[],
        english_level=None,
        interests=[],
        blocked_titles=[],
        favorite_words=[],
    )
    assert len(many_result.related_words) == 5

    # Response with a single related word should still be accepted.
    single_related = {
        "related_words": [
            {"word": "only", "relationship": "synonym", "difference": "d", "when_to_use": "u"}
        ],
        "personalized": "tip",
    }
    orchestrator.client = _StubClient(single_related)
    single_result: Layer4Response = await orchestrator.generate_layer4(
        word="test",
        context="This is a test sentence.",
    )
    assert len(single_result.related_words) == 1


def test_model_for_prefers_overrides_and_falls_back_to_default(monkeypatch):
    """_model_for should respect per-layer overrides and generic fast model."""
    # Keep a copy of the original values to restore after the test.
    original_default = settings.openrouter_model_id
    original_fast = settings.openrouter_fast_model_id
    original_layer3 = settings.openrouter_layer3_model_id
    original_layer4_fast = settings.openrouter_layer4_fast_model_id
    original_layer4_main = settings.openrouter_layer4_main_model_id

    monkeypatch.setattr(settings, "openrouter_model_id", "default-model", raising=False)
    monkeypatch.setattr(settings, "openrouter_fast_model_id", "fast-model", raising=False)
    monkeypatch.setattr(settings, "openrouter_layer3_model_id", "layer3-model", raising=False)
    monkeypatch.setattr(
        settings, "openrouter_layer4_fast_model_id", "layer4-fast-model", raising=False
    )
    monkeypatch.setattr(
        settings, "openrouter_layer4_main_model_id", "layer4-main-model", raising=False
    )

    orchestrator = LLMOrchestrator()

    assert orchestrator._model_for("layer2") == "fast-model"
    assert orchestrator._model_for("layer3") == "layer3-model"
    assert orchestrator._model_for("layer4_fast") == "layer4-fast-model"
    assert orchestrator._model_for("layer4") == "layer4-main-model"
    # Unknown layers should fall back to the global default.
    assert orchestrator._model_for("unknown") == "default-model"

    # Restore original settings to avoid leaking state to other tests.
    monkeypatch.setattr(settings, "openrouter_model_id", original_default, raising=False)
    monkeypatch.setattr(settings, "openrouter_fast_model_id", original_fast, raising=False)
    monkeypatch.setattr(settings, "openrouter_layer3_model_id", original_layer3, raising=False)
    monkeypatch.setattr(
        settings, "openrouter_layer4_fast_model_id", original_layer4_fast, raising=False
    )
    monkeypatch.setattr(
        settings, "openrouter_layer4_main_model_id", original_layer4_main, raising=False
    )


@pytest.mark.asyncio
async def test_generate_layer4_candidates_uses_fast_model_and_caps_results():
    """Stage A candidate generation should use the fast model and cap to 5 items."""
    stub_response = [
        {"word": f"w{i}", "relationship": "synonym"}
        for i in range(7)
    ]

    orchestrator = LLMOrchestrator()
    orchestrator.client = _StubClient(stub_response)

    candidates = await orchestrator.generate_layer4_candidates(
        word="test",
        context="This is a test sentence.",
    )

    # Capped to at most 5 RelatedWord objects and at least one.
    assert 1 <= len(candidates) <= 5
    assert all(isinstance(c, RelatedWord) for c in candidates)

    # The underlying client should have been called with a model and small max_tokens.
    assert orchestrator.client.last_kwargs is not None
    assert "model" in orchestrator.client.last_kwargs
    assert orchestrator.client.last_kwargs.get("max_tokens") <= 200


@pytest.mark.asyncio
async def test_enrich_layer4_from_candidates_uses_main_model_and_parses_response():
    """Stage B enrichment should call the main model and return a valid Layer4Response."""
    stub_response = {
        "related_words": [
            {
                "word": "w1",
                "relationship": "synonym",
                "difference": "d1",
                "when_to_use": "u1",
            },
            {
                "word": "w2",
                "relationship": "antonym",
                "difference": "d2",
                "when_to_use": "u2",
            },
        ],
        "personalized": "tip",
    }

    orchestrator = LLMOrchestrator()
    orchestrator.client = _StubClient(stub_response)

    candidates = [
        RelatedWord(word="c1", relationship="synonym", difference="", when_to_use=""),
        RelatedWord(word="c2", relationship="antonym", difference="", when_to_use=""),
    ]

    result: Layer4Response = await orchestrator.enrich_layer4_from_candidates(
        word="test",
        context="This is a test sentence.",
        candidates=candidates,
        learning_history=["history"],
        english_level="B1",
        interests=[],
        blocked_titles=[],
        favorite_words=[],
    )

    assert isinstance(result, Layer4Response)
    assert len(result.related_words) == 2
    assert result.related_words[0].word == "w1"
    assert result.personalized == "tip"
