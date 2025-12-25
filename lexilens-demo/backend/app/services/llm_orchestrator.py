from __future__ import annotations

import asyncio
import json
import logging
from collections.abc import AsyncGenerator
from typing import Any, List, Optional

from app.config import settings
from app.prompt_config import PROMPT_CONFIG
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

    def _model_for(self, layer: str) -> str:
        """
        Select the model id for a given logical layer.

        Falls back to the global default when no layer-specific override is set.
        """
        if layer == "layer2":
            return settings.openrouter_fast_model_id or settings.openrouter_model_id
        if layer == "layer3":
            return settings.openrouter_layer3_model_id or settings.openrouter_model_id
        if layer == "layer4_fast":
            return (
                settings.openrouter_layer4_fast_model_id
                or settings.openrouter_fast_model_id
                or settings.openrouter_model_id
            )
        if layer == "layer4":
            return (
                settings.openrouter_layer4_main_model_id
                or settings.openrouter_model_id
            )

        return settings.openrouter_model_id

    def _reasoning_kwargs(self, layer: str) -> dict[str, Any]:
        """
        Optional vendor-specific reasoning / thinking parameters.

        These are only attached when the corresponding layer flag is enabled so
        we can experiment safely without changing call sites.
        """
        if layer == "layer3" and settings.openrouter_layer3_thinking_enabled:
            # Keep effort modest to control latency / cost.
            return {"reasoning": {"effort": "medium"}}
        if layer == "layer4" and settings.openrouter_layer4_thinking_enabled:
            return {"reasoning": {"effort": "medium"}}

        return {}

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
        system_prompt, user_prompt = self.prompt_builder.build_layer2_prompt(
            word,
            context,
        )

        response = await self.client.complete_json(
            prompt=user_prompt,
            system_prompt=system_prompt,
            temperature=0.8,
            max_tokens=600,
            model=self._model_for("layer2"),
        )

        if not isinstance(response, list) or len(response) != 3:
            raise OpenRouterError("Layer 2 response must be a list of 3 contexts")

        contexts = []
        for item in response:
            # Frontend derives icons from `source`, so we intentionally ignore
            # any `icon` keys returned by the LLM to save tokens.
            contexts.append(
                LiveContext(
                    source=item.get("source", "unknown"),
                    text=item.get("text", ""),
                )
            )

        return Layer2Response(contexts=contexts)

    async def generate_layer3(
        self,
        word: str,
        context: str,
        english_level: str | None = None,
        max_items: int = 2,
    ) -> Layer3Response:
        system_prompt, user_prompt = self.prompt_builder.build_layer3_prompt(
            word,
            context,
            english_level,
        )

        response = await self.client.complete_json(
            prompt=user_prompt,
            system_prompt=system_prompt,
            temperature=0.7,
            max_tokens=400,
            model=self._model_for("layer3"),
            **self._reasoning_kwargs("layer3"),
        )

        if not isinstance(response, list) or len(response) < 1:
            raise OpenRouterError(
                "Layer 3 response must be a list of at least 1 mistake"
            )

        # Always keep at least one mistake for UX, but allow experiments with
        # fewer than the default 2 items when desired.
        limit = max(1, max_items)
        mistakes = []
        for item in response[:limit]:
            mistakes.append(
                CommonMistake(
                    wrong=item.get("wrong", ""),
                    why=item.get("why", ""),
                    correct=item.get("correct", ""),
                )
            )

        return Layer3Response(mistakes=mistakes)

    async def generate_layer4_candidates(
        self,
        word: str,
        context: str,
    ) -> list[RelatedWord]:
        """
        Stage A: use a fast model to recall candidate related words.

        Returns a list of RelatedWord objects where only `word` and
        `relationship` are populated; `difference` and `when_to_use` are left
        empty for the enrichment stage.
        """
        system_prompt, user_prompt = self.prompt_builder.build_layer4_candidates_prompt(
            word,
            context,
        )

        response = await self.client.complete_json(
            prompt=user_prompt,
            system_prompt=system_prompt,
            temperature=0.7,
            max_tokens=200,
            model=self._model_for("layer4_fast"),
        )

        if not isinstance(response, list) or len(response) < 1:
            raise OpenRouterError(
                "Layer 4 candidate response must be a non-empty JSON array"
            )

        max_candidates = 5
        candidates: list[RelatedWord] = []
        for item in response[:max_candidates]:
            if not isinstance(item, dict):
                logger.warning("Skipping non-dict layer4 candidate: %s", item)
                continue

            candidates.append(
                RelatedWord(
                    word=item.get("word", "") or "",
                    relationship=item.get("relationship", "") or "",
                    difference="",
                    when_to_use="",
                )
            )

        if not candidates:
            raise OpenRouterError(
                "Layer 4 candidate generation produced no valid items"
            )

        return candidates

    async def generate_layer4_personalized_stream(
        self,
        word: str,
        context: str,
        learning_history: list[str] | None = None,
        english_level: str | None = None,
        interests: Optional[List[InterestTopicPayload]] = None,
        blocked_titles: Optional[List[str]] = None,
        favorite_words: Optional[List[str]] = None,
    ) -> AsyncGenerator[str, None]:
        """
        Stream-only generation of the personalized coaching text (解读部分).

        This is separate from the main Layer 4 JSON response so that the
        frontend can start rendering the 解读 copy earlier without waiting
        for the full lexical map enrichment to finish.
        """
        (
            system_prompt,
            user_prompt,
        ) = self.prompt_builder.build_layer4_personalized_prompt(
            word=word,
            context=context,
            learning_history=learning_history,
            english_level=english_level,
            interests=interests,
            blocked_titles=blocked_titles,
            favorite_words=favorite_words,
        )

        async for chunk in self.client.stream(
            prompt=user_prompt,
            system_prompt=system_prompt,
            temperature=0.7,
            max_tokens=400,
            model=self._model_for("layer4"),
            **self._reasoning_kwargs("layer4"),
        ):
            yield chunk

    async def enrich_layer4_from_candidates(
        self,
        word: str,
        context: str,
        candidates: list[RelatedWord],
        learning_history: list[str] | None = None,
        english_level: str | None = None,
        interests: Optional[List[InterestTopicPayload]] = None,
        blocked_titles: Optional[List[str]] = None,
        favorite_words: Optional[List[str]] = None,
    ) -> Layer4Response:
        """
        Stage B: use the main model to enrich candidate related words with
        differences, usage guidance, and personalized coaching text.
        """
        # Prepare a compact JSON representation of candidate words for the prompt.
        candidates_payload: list[dict[str, str]] = []
        for candidate in candidates[:5]:
            try:
                if hasattr(candidate, "model_dump"):
                    data = candidate.model_dump()
                elif isinstance(candidate, dict):
                    data = candidate
                else:
                    # Fallback for any unexpected type.
                    data = dict(candidate)
            except Exception:  # noqa: BLE001
                logger.warning("Skipping invalid candidate in enrichment: %s", candidate)
                continue

            word_value = (data.get("word") or "").strip()
            relationship_value = (data.get("relationship") or "").strip()
            if not word_value:
                continue

            candidates_payload.append(
                {
                    "word": word_value,
                    "relationship": relationship_value,
                }
            )

        candidates_for_prompt = ""
        if candidates_payload:
            candidates_for_prompt = json.dumps(
                candidates_payload,
                ensure_ascii=False,
            )

        system_prompt, user_prompt = self.prompt_builder.build_layer4_prompt(
            word,
            context,
            learning_history,
            english_level,
            interests,
            blocked_titles,
            favorite_words,
            candidates_for_prompt=candidates_for_prompt,
        )

        response = await self.client.complete_json(
            prompt=user_prompt,
            system_prompt=system_prompt,
            temperature=0.7,
            max_tokens=600,
            model=self._model_for("layer4"),
            **self._reasoning_kwargs("layer4"),
        )

        if not isinstance(response, dict) or "related_words" not in response:
            raise OpenRouterError("Layer 4 response must contain 'related_words' key")

        related_words_data = response.get("related_words", [])
        if not isinstance(related_words_data, list) or len(related_words_data) < 1:
            raise OpenRouterError("Layer 4 must contain at least 1 related word")

        # Cap the number of related words we materialize for performance while
        # allowing the prompt to request up to 5.
        max_related = 5
        related_words: list[RelatedWord] = []
        for item in related_words_data[:max_related]:
            if not isinstance(item, dict):
                logger.warning("Skipping non-dict related word item: %s", item)
                continue

            related_words.append(
                RelatedWord(
                    word=item.get("word", "") or "",
                    relationship=item.get("relationship", "") or "",
                    difference=item.get("difference", "") or "",
                    when_to_use=item.get("when_to_use", "") or "",
                )
            )

        if not related_words:
            raise OpenRouterError(
                "Layer 4 enrichment did not yield any valid related words"
            )

        personalized = response.get("personalized")

        return Layer4Response(
            related_words=related_words,
            personalized=personalized,
        )

    async def generate_layer4(
        self,
        word: str,
        context: str,
        learning_history: list[str] | None = None,
        english_level: str | None = None,
        interests: Optional[List[InterestTopicPayload]] = None,
        blocked_titles: Optional[List[str]] = None,
        favorite_words: Optional[List[str]] = None,
    ) -> Layer4Response:
        """
        Orchestrate the two-stage Lexical Map pipeline while preserving the
        existing Layer4Response contract.
        """
        candidates = await self.generate_layer4_candidates(
            word=word,
            context=context,
        )

        return await self.enrich_layer4_from_candidates(
            word=word,
            context=context,
            candidates=candidates,
            learning_history=learning_history,
            english_level=english_level,
            interests=interests,
            blocked_titles=blocked_titles,
            favorite_words=favorite_words,
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
        prompt_cfg = PROMPT_CONFIG["summarize_interests"]
        system_prompt = prompt_cfg["system_prompt"]

        existing_topics = existing_topics or []
        blocked_titles = blocked_titles or []

        existing_for_prompt: list[dict[str, Any]] = []
        for topic in existing_topics:
            if hasattr(topic, "model_dump"):
                existing_for_prompt.append(topic.model_dump())
            else:
                # Fallback in case plain dicts are passed in.
                existing_for_prompt.append(dict(topic))

        usage_summary = prompt_cfg["usage_summary_template"].format(
            word=word,
            context=context,
            page_type=page_type or "unknown",
            url=url or "unknown",
        )

        user_prompt = prompt_cfg["user_prompt_template"].format(
            usage_summary=usage_summary,
            existing_for_prompt=existing_for_prompt,
            blocked_titles=blocked_titles,
        )

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
        favorite_words = request.favorite_words or []
        raw_layers = request.layers or [2, 3, 4]
        requested_layers: set[int] = {layer for layer in raw_layers if layer in (2, 3, 4)}
        if not requested_layers:
            # Fallback to the default when the client sends an empty/invalid list.
            requested_layers = {2, 3, 4}

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

            tasks: dict[str, asyncio.Task[Any]] = {}
            if 2 in requested_layers:
                tasks["layer2"] = asyncio.create_task(
                    self.generate_layer2(word, context)
                )
            if 3 in requested_layers:
                tasks["layer3"] = asyncio.create_task(
                    self.generate_layer3(
                        word,
                        context,
                        english_level,
                    )
                )
            if 4 in requested_layers:
                tasks["layer4"] = asyncio.create_task(
                    self.generate_layer4(
                        word,
                        context,
                        learning_history,
                        english_level,
                        interests,
                        blocked_titles,
                        favorite_words,
                    )
                )

            pending: dict[str, asyncio.Task[Any]] = dict(tasks)

            # Optional streaming task for the 解读 (personalized coaching) text.
            personalized_queue: asyncio.Queue[dict[str, Any] | None] | None = None
            personalized_future: asyncio.Task[dict[str, Any] | None] | None = None
            personalized_done = True

            if 4 in requested_layers:
                personalized_queue = asyncio.Queue()
                personalized_done = False

                async def _stream_personalized() -> None:
                    try:
                        async for chunk in self.generate_layer4_personalized_stream(
                            word=word,
                            context=context,
                            learning_history=learning_history,
                            english_level=english_level,
                            interests=interests,
                            blocked_titles=blocked_titles,
                            favorite_words=favorite_words,
                        ):
                            await personalized_queue.put(
                                {
                                    "event": "layer4_personalized_chunk",
                                    "data": {"content": chunk},
                                }
                            )
                    except Exception as exc:  # noqa: BLE001
                        logger.error(
                            "Error streaming personalized coaching for '%s': %s",
                            word,
                            exc,
                        )
                    finally:
                        # Sentinel to signal completion; the outer loop will
                        # stop waiting on further personalized chunks once it
                        # receives this marker.
                        await personalized_queue.put(None)

                # Fire-and-forget streaming task; events are funneled through
                # the queue so they can be merged with layer completion events.
                asyncio.create_task(_stream_personalized())

            while pending or not personalized_done:
                wait_tasks: set[asyncio.Task[Any]] = set()
                if pending:
                    wait_tasks.update(pending.values())

                if not personalized_done and personalized_queue is not None:
                    if personalized_future is None:
                        personalized_future = asyncio.create_task(
                            personalized_queue.get()
                        )
                    wait_tasks.add(personalized_future)

                if not wait_tasks:
                    # Nothing left to wait on; break to avoid a dead-loop.
                    break

                done, _ = await asyncio.wait(
                    wait_tasks,
                    return_when=asyncio.FIRST_COMPLETED,
                )

                # Handle personalized streaming chunks first, if any.
                if (
                    not personalized_done
                    and personalized_future is not None
                    and personalized_future in done
                ):
                    try:
                        personalized_event = personalized_future.result()
                    except Exception as exc:  # noqa: BLE001
                        logger.error(
                            "Error consuming personalized coaching queue for '%s': %s",
                            word,
                            exc,
                        )
                        personalized_event = None

                    # Reset so a new get() can be scheduled on the next loop
                    # iteration if the stream is still active.
                    personalized_future = None

                    if personalized_event is None:
                        personalized_done = True
                    else:
                        yield personalized_event

                # Handle layer completion events.
                for event_name, task in list(pending.items()):
                    if task not in done:
                        continue

                    pending.pop(event_name, None)

                    try:
                        result = await task
                        yield {
                            "event": event_name,
                            "data": result.model_dump(),
                        }
                        logger.info("%s completed for '%s'", event_name, word)
                    except Exception as e:  # noqa: BLE001
                        logger.error("Error in %s: %s", event_name, e)
                        yield {
                            "event": f"{event_name}_error",
                            "data": {"error": str(e)},
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
