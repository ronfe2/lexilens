import asyncio
import logging
from collections.abc import AsyncGenerator
from typing import Any, List, Optional

from app.models.interests import InterestTopicPayload
from app.models.request import AnalyzeRequest
from app.models.response import (
    CommonMistake,
    Layer2Response,
    Layer3Response,
    Layer4Response,
    LiveContext,
    RelatedWord,
)
from app.services.openrouter import openrouter_client
from app.services.prompt_builder import PromptBuilder
from app.utils.error_handling import OpenRouterError

logger = logging.getLogger(__name__)


class LLMOrchestrator:
    def __init__(self):
        self.client = openrouter_client
        self.prompt_builder = PromptBuilder()

    async def generate_layer1_stream(
        self,
        word: str,
        context: str,
        english_level: str | None = None
    ) -> AsyncGenerator[str, None]:
        system_prompt, user_prompt = self.prompt_builder.build_layer1_prompt(
            word,
            context,
            english_level,
        )

        full_content = ""
        async for chunk in self.client.stream(
            prompt=user_prompt,
            system_prompt=system_prompt,
            temperature=0.7,
            max_tokens=300
        ):
            full_content += chunk
            yield chunk

        if not full_content.strip():
            raise OpenRouterError("Layer 1 returned empty content")

    async def generate_layer2(self, word: str, context: str) -> Layer2Response:
        system_prompt, user_prompt = self.prompt_builder.build_layer2_prompt(word, context)

        response = await self.client.complete_json(
            prompt=user_prompt,
            system_prompt=system_prompt,
            temperature=0.8,
            max_tokens=600
        )

        if not isinstance(response, list) or len(response) != 3:
            raise OpenRouterError("Layer 2 response must be a list of 3 contexts")

        contexts = []
        for item in response:
            contexts.append(LiveContext(
                source=item.get("source", "unknown"),
                text=item.get("text", ""),
                icon=item.get("icon")
            ))

        return Layer2Response(contexts=contexts)

    async def generate_layer3(self, word: str, context: str) -> Layer3Response:
        system_prompt, user_prompt = self.prompt_builder.build_layer3_prompt(word, context)

        response = await self.client.complete_json(
            prompt=user_prompt,
            system_prompt=system_prompt,
            temperature=0.7,
            max_tokens=600
        )

        if not isinstance(response, list) or len(response) < 1:
            raise OpenRouterError("Layer 3 response must be a list of at least 1 mistake")

        mistakes = []
        for item in response[:2]:
            mistakes.append(CommonMistake(
                wrong=item.get("wrong", ""),
                why=item.get("why", ""),
                correct=item.get("correct", "")
            ))

        return Layer3Response(mistakes=mistakes)

    async def generate_layer4(
        self,
        word: str,
        context: str,
        learning_history: list[str] | None = None,
        english_level: str | None = None,
        interests: Optional[List[InterestTopicPayload]] = None,
        blocked_titles: Optional[List[str]] = None,
    ) -> Layer4Response:
        system_prompt, user_prompt = self.prompt_builder.build_layer4_prompt(
            word,
            context,
            learning_history,
            english_level,
            interests,
            blocked_titles,
        )

        response = await self.client.complete_json(
            prompt=user_prompt,
            system_prompt=system_prompt,
            temperature=0.7,
            max_tokens=800
        )

        if not isinstance(response, dict) or "related_words" not in response:
            raise OpenRouterError("Layer 4 response must contain 'related_words' key")

        related_words_data = response.get("related_words", [])
        if not isinstance(related_words_data, list) or len(related_words_data) < 1:
            raise OpenRouterError("Layer 4 must contain at least 1 related word")

        related_words = []
        for item in related_words_data[:2]:
            related_words.append(RelatedWord(
                word=item.get("word", ""),
                relationship=item.get("relationship", ""),
                difference=item.get("difference", ""),
                when_to_use=item.get("when_to_use", "")
            ))

        personalized = response.get("personalized")

        return Layer4Response(
            related_words=related_words,
            personalized=personalized
        )

    async def summarize_interests_from_usage(
        self,
        word: str,
        context: str,
        page_type: str | None,
        url: str | None,
        existing_topics: list[InterestTopicPayload] | None = None,
        blocked_titles: list[str] | None = None,
    ) -> list[InterestTopicPayload]:
        """
        Use the LLM to decide how the latest LexiLens usage should update
        the learner's interest topics.

        The model receives the current topics and a list of blocked titles,
        and must return the full updated topics list.
        """
        system_prompt = (
            "You are an assistant that organizes a single learner's reading "
            "interests into a few stable topics."
        )

        existing_topics = existing_topics or []
        blocked_titles = blocked_titles or []

        existing_for_prompt: list[dict[str, Any]] = []
        for topic in existing_topics:
            if hasattr(topic, "model_dump"):
                existing_for_prompt.append(topic.model_dump())
            else:
                # Fallback in case plain dicts are passed in.
                existing_for_prompt.append(dict(topic))

        usage_summary = f"""Latest LexiLens usage:
- word: {word}
- context: {context}
- page_type: {page_type or "unknown"}
- url: {url or "unknown"}
"""

        user_prompt = f"""{usage_summary}

Existing topics (may be empty). Each has an id, title, summary and example URLs:
{existing_for_prompt}

Blocked titles (topics removed by the user; NEVER bring them back): {blocked_titles}

Task:
1. Decide whether this latest usage should:
   - be merged into one existing topic, or
   - create a new topic, or
   - be ignored if it does not represent a meaningful interest.
2. Always return the FULL list of topics the extension should store after this update.
3. Each topic object must contain:
   - id: short stable identifier (slug-like, no spaces, e.g. "football_premier_league").
   - title: short Chinese or bilingual title describing the interest.
   - summary: 1 short sentence in Chinese describing what the learner does or follows.
   - urls: array of URLs (strings) belonging to this topic. Include the latest URL \
when appropriate.
4. If you update an existing topic, keep its id exactly the same.
5. Never create or return topics whose title is in the blocked titles list.

Return ONLY a JSON array of topic objects, without any surrounding explanation."""

        response = await self.client.complete_json(
            prompt=user_prompt,
            system_prompt=system_prompt,
            temperature=0.6,
            max_tokens=800,
        )

        if not isinstance(response, list):
            raise OpenRouterError("Interests response must be a JSON array of topics")

        blocked_set = {title.strip().lower() for title in blocked_titles}
        topics: list[InterestTopicPayload] = []

        for item in response:
            if not isinstance(item, dict):
                logger.warning("Skipping non-dict interest topic: %s", item)
                continue

            try:
                topic = InterestTopicPayload(
                    id=item.get("id"),
                    title=item.get("title", "").strip(),
                    summary=item.get("summary", "").strip(),
                    urls=item.get("urls") or [],
                )
            except Exception as exc:  # noqa: BLE001
                logger.warning("Skipping invalid interest topic payload %s: %s", item, exc)
                continue

            if topic.title and topic.title.strip().lower() in blocked_set:
                # Enforce the blocklist even if the model ignored instructions.
                continue

            topics.append(topic)

        return topics

    async def analyze_streaming(
        self,
        request: AnalyzeRequest
    ) -> AsyncGenerator[dict[str, Any], None]:
        word = request.word
        context = request.context
        learning_history = request.learning_history or []
        english_level = request.english_level
        interests = request.interests or []
        blocked_titles = request.blocked_titles or []

        try:
            full_layer1_content = ""
            async for chunk in self.generate_layer1_stream(word, context, english_level):
                full_layer1_content += chunk
                yield {
                    "event": "layer1_chunk",
                    "data": {"content": chunk}
                }

            yield {
                "event": "layer1_complete",
                "data": {"content": full_layer1_content}
            }

            logger.info(f"Layer 1 completed for '{word}'")

            layer2_task = asyncio.create_task(self.generate_layer2(word, context))
            layer3_task = asyncio.create_task(self.generate_layer3(word, context))
            layer4_task = asyncio.create_task(
                self.generate_layer4(
                    word,
                    context,
                    learning_history,
                    english_level,
                    interests,
                    blocked_titles,
                )
            )

            for task, event_name in [
                (layer2_task, "layer2"),
                (layer3_task, "layer3"),
                (layer4_task, "layer4")
            ]:
                try:
                    result = await task
                    yield {
                        "event": event_name,
                        "data": result.model_dump()
                    }
                    logger.info(f"{event_name} completed for '{word}'")
                except Exception as e:
                    logger.error(f"Error in {event_name}: {e}")
                    yield {
                        "event": f"{event_name}_error",
                        "data": {"error": str(e)}
                    }

            yield {
                "event": "done",
                "data": {}
            }

        except Exception as e:
            logger.error(f"Error in analyze_streaming: {e}")
            yield {
                "event": "error",
                "data": {"error": str(e)}
            }


llm_orchestrator = LLMOrchestrator()
