from __future__ import annotations

from fastapi.testclient import TestClient
import pytest

from app.main import app
from app.models.response import (
    CommonMistake,
    Layer3Response,
    Layer4Response,
    RelatedWord,
)
from app.utils.error_handling import OpenRouterError


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def test_analyze_mistakes_endpoint_happy_path(monkeypatch, client: TestClient):
    # Patch the orchestrator so the test does not hit the real LLM.
    from app.api.routes import analyze as analyze_routes

    async def fake_generate_layer3(
        word: str,
        context: str,
        english_level: str | None = None,
        max_items: int = 2,
    ) -> Layer3Response:
        return Layer3Response(
            mistakes=[
                CommonMistake(
                    wrong="wrong usage",
                    why="why explanation",
                    correct="correct usage",
                )
            ]
        )

    monkeypatch.setattr(
        analyze_routes.llm_orchestrator,
        "generate_layer3",
        fake_generate_layer3,
    )

    payload = {
        "word": "test",
        "context": "This is a test sentence.",
        "english_level": "B1",
    }

    response = client.post("/api/analyze/mistakes", json=payload)
    assert response.status_code == 200

    data = response.json()
    assert "mistakes" in data
    assert isinstance(data["mistakes"], list)
    assert len(data["mistakes"]) == 1
    assert data["mistakes"][0]["wrong"] == "wrong usage"


def test_analyze_mistakes_endpoint_maps_openrouter_error(monkeypatch, client: TestClient):
    from app.api.routes import analyze as analyze_routes

    async def fake_generate_layer3_error(
        word: str,
        context: str,
        english_level: str | None = None,
        max_items: int = 2,
    ) -> Layer3Response:
        raise OpenRouterError("boom", status_code=502)

    monkeypatch.setattr(
        analyze_routes.llm_orchestrator,
        "generate_layer3",
        fake_generate_layer3_error,
    )

    payload = {
        "word": "test",
        "context": "This is a test sentence.",
    }

    response = client.post("/api/analyze/mistakes", json=payload)
    assert response.status_code == 502
    assert response.json()["detail"] == "boom"


def test_lexical_map_text_endpoint_happy_path(monkeypatch, client: TestClient):
    from app.api.routes import lexical_map as lexical_map_routes

    async def fake_generate_layer4(
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
            personalized="personalized tip",
        )

    monkeypatch.setattr(
        lexical_map_routes.llm_orchestrator,
        "generate_layer4",
        fake_generate_layer4,
    )

    payload = {
        "word": "test",
        "context": "This is a test sentence.",
        "learning_history": ["a", "b"],
        "english_level": "B2",
        "interests": [],
        "blocked_titles": [],
        "favorite_words": [],
    }

    response = client.post("/api/lexical-map/text", json=payload)
    assert response.status_code == 200

    data = response.json()
    assert "related_words" in data
    assert isinstance(data["related_words"], list)
    assert len(data["related_words"]) == 1
    assert data["related_words"][0]["word"] == "related"
    assert data["personalized"] == "personalized tip"


def test_lexical_map_text_endpoint_maps_openrouter_error(monkeypatch, client: TestClient):
    from app.api.routes import lexical_map as lexical_map_routes

    async def fake_generate_layer4_error(
        word: str,
        context: str,
        learning_history: list[str] | None = None,
        english_level: str | None = None,
        interests=None,
        blocked_titles=None,
        favorite_words=None,
    ) -> Layer4Response:
        raise OpenRouterError("lex boom", status_code=503)

    monkeypatch.setattr(
        lexical_map_routes.llm_orchestrator,
        "generate_layer4",
        fake_generate_layer4_error,
    )

    payload = {
        "word": "test",
        "context": "This is a test sentence.",
    }

    response = client.post("/api/lexical-map/text", json=payload)
    assert response.status_code == 503
    assert response.json()["detail"] == "lex boom"

