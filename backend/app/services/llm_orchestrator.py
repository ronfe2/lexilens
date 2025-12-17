import asyncio
import logging
from collections.abc import AsyncGenerator
from typing import Any

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
        context: str
    ) -> AsyncGenerator[str, None]:
        system_prompt, user_prompt = self.prompt_builder.build_layer1_prompt(word, context)

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
        learning_history: list[str] = None
    ) -> Layer4Response:
        system_prompt, user_prompt = self.prompt_builder.build_layer4_prompt(
            word, context, learning_history
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

    async def analyze_streaming(
        self,
        request: AnalyzeRequest
    ) -> AsyncGenerator[dict[str, Any], None]:
        word = request.word
        context = request.context
        learning_history = request.learning_history or []

        try:
            full_layer1_content = ""
            async for chunk in self.generate_layer1_stream(word, context):
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
                self.generate_layer4(word, context, learning_history)
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
