import json
import logging
from collections.abc import AsyncGenerator
from typing import Any

import httpx

from app.config import settings
from app.utils.error_handling import (
    APIConnectionError,
    OpenRouterError,
    RateLimitError,
    async_retry,
)

logger = logging.getLogger(__name__)


class OpenRouterClient:
    def __init__(
        self,
        api_key: str | None = None,
        model_id: str | None = None,
        base_url: str | None = None,
    ):
        self.api_key = api_key or settings.openrouter_api_key
        self.model_id = model_id or settings.openrouter_model_id
        self.base_url = base_url or settings.openrouter_base_url
        self.timeout = settings.request_timeout

        if not self.api_key:
            raise ValueError("OpenRouter API key is required")

    def _get_headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://lexilens.app",
            "X-Title": "LexiLens"
        }

    async def _handle_error_response(self, response: httpx.Response) -> None:
        try:
            error_data = response.json()
            error_message = error_data.get("error", {}).get("message", "Unknown error")
        except Exception:
            error_message = response.text or "Unknown error"

        if response.status_code == 429:
            retry_after = int(response.headers.get("Retry-After", 60))
            raise RateLimitError(error_message, retry_after=retry_after)
        elif response.status_code >= 500:
            raise APIConnectionError(f"Server error: {error_message}")
        else:
            raise OpenRouterError(
                error_message,
                status_code=response.status_code,
                detail=error_data if 'error_data' in locals() else None
            )

    @async_retry(max_retries=3, initial_delay=1.0)
    async def complete(
        self,
        prompt: str,
        system_prompt: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 1000,
        **kwargs: Any
    ) -> str:
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": self.model_id,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            **kwargs
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers=self._get_headers(),
                    json=payload
                )

                if response.status_code != 200:
                    await self._handle_error_response(response)

                data = response.json()
                content = data["choices"][0]["message"]["content"]
                return content

            except httpx.TimeoutException:
                raise APIConnectionError("Request timeout")
            except httpx.RequestError as e:
                raise APIConnectionError(f"Connection error: {str(e)}")

    @async_retry(max_retries=3, initial_delay=1.0)
    async def stream(
        self,
        prompt: str,
        system_prompt: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 1000,
        **kwargs: Any
    ) -> AsyncGenerator[str, None]:
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": self.model_id,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": True,
            **kwargs
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                async with client.stream(
                    "POST",
                    f"{self.base_url}/chat/completions",
                    headers=self._get_headers(),
                    json=payload
                ) as response:
                    if response.status_code != 200:
                        await self._handle_error_response(response)

                    full_content = ""
                    async for line in response.aiter_lines():
                        if not line.strip():
                            continue

                        if line.startswith("data: "):
                            data_str = line[6:]

                            if data_str == "[DONE]":
                                break

                            try:
                                data = json.loads(data_str)
                                delta = data["choices"][0].get("delta", {})
                                content = delta.get("content", "")

                                if content:
                                    full_content += content
                                    yield content

                            except json.JSONDecodeError:
                                logger.warning(f"Failed to parse streaming data: {data_str}")
                                continue

                    if not full_content:
                        raise OpenRouterError("No content received from stream")

            except httpx.TimeoutException:
                raise APIConnectionError("Request timeout")
            except httpx.RequestError as e:
                raise APIConnectionError(f"Connection error: {str(e)}")

    async def complete_json(
        self,
        prompt: str,
        system_prompt: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 1000,
        **kwargs: Any
    ) -> dict[str, Any]:
        response = await self.complete(
            prompt=prompt,
            system_prompt=system_prompt,
            temperature=temperature,
            max_tokens=max_tokens,
            **kwargs
        )

        try:
            response_text = response.strip()
            if response_text.startswith("```json"):
                response_text = response_text[7:]
            if response_text.endswith("```"):
                response_text = response_text[:-3]
            response_text = response_text.strip()

            return json.loads(response_text)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON response: {response}")
            raise OpenRouterError(f"Invalid JSON response: {str(e)}", detail=response)


openrouter_client = OpenRouterClient()
