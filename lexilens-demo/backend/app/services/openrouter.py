import json
import logging
import re
from collections.abc import AsyncGenerator
from typing import Any, Optional

import httpx

from app.config import settings
from app.utils.error_handling import (
    APIConnectionError,
    OpenRouterError,
    RateLimitError,
    async_retry,
)

logger = logging.getLogger(__name__)


def _extract_json_from_text(text: str) -> str:
    """
    Extract a JSON object/array from an LLM response that may include
    explanations or Markdown fences.

    Priority:
    1) First ```json ... ``` fenced block (most common pattern)
    2) Fallback to substring from first '{'/'[' to last '}'/']'
    3) If nothing obvious is found, return the original text.
    """
    if not text:
        return text

    # Try to find a fenced ```json block first
    fence_match = re.search(
        r"```(?:json)?\s*(.*?)```", text, flags=re.IGNORECASE | re.DOTALL
    )
    if fence_match:
        return fence_match.group(1).strip()

    stripped = text.strip()

    # Fallback: look for first JSON-looking character
    first_obj = stripped.find("{")
    first_arr = stripped.find("[")

    candidates = [i for i in (first_obj, first_arr) if i != -1]
    if not candidates:
        # No apparent JSON start; just return original
        return stripped

    start = min(candidates)
    candidate = stripped[start:]

    # Try to cut off trailing explanation after the JSON block
    last_obj = candidate.rfind("}")
    last_arr = candidate.rfind("]")
    last = max(last_obj, last_arr)
    if last != -1:
        candidate = candidate[: last + 1]

    return candidate.strip()


class OpenRouterClient:
    def __init__(
        self,
        api_key: Optional[str] = None,
        model_id: Optional[str] = None,
        base_url: Optional[str] = None,
    ):
        self.api_key = api_key or settings.openrouter_api_key
        self.model_id = model_id or settings.openrouter_model_id
        self.base_url = base_url or settings.openrouter_base_url
        self.timeout = settings.request_timeout
        # Use a dedicated image model when provided; otherwise fall back to the main model.
        self.image_model_id = settings.openrouter_image_model_id or self.model_id

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
    async def generate_image(
        self,
        prompt: str,
        model_id: Optional[str] = None,
        temperature: float = 0.7,
    ) -> str:
        """
        Call an OpenRouter image-capable model and return a single image URL.

        The response shape follows OpenRouter's multimodal chat completions where
        image outputs are attached to the first choice's message as an `images`
        collection containing `image_url.url` fields.
        """
        messages = [{"role": "user", "content": prompt}]

        payload: dict[str, Any] = {
            "model": model_id or self.image_model_id,
            "messages": messages,
            "temperature": temperature,
            # We mostly care about the image output, so keep text small.
            "max_tokens": 256,
            # Explicitly request image output in addition to text.
            "modalities": ["text", "image"],
            "stream": False,
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers=self._get_headers(),
                    json=payload,
                )

                if response.status_code != 200:
                    await self._handle_error_response(response)

                data = response.json()

                try:
                    choices = data.get("choices") or []
                    if not choices:
                        raise KeyError("No choices in response")

                    message = choices[0].get("message") or {}
                    images = message.get("images") or []
                    if not images:
                        raise KeyError("No images in response")

                    first_image = images[0]
                    image_url_obj = first_image.get("image_url") or {}
                    image_url = image_url_obj.get("url")

                    if not image_url:
                        raise KeyError("Missing image_url.url in response")

                    return image_url
                except Exception as e:  # noqa: BLE001
                    # Log a concise summary of the unexpected response shape to aid debugging
                    logger.error(
                        "Failed to parse image response from OpenRouter: %s | top-level keys=%s",
                        e,
                        list(data.keys()) if isinstance(data, dict) else type(data),
                    )
                    raise OpenRouterError("No image received from OpenRouter")

            except httpx.TimeoutException:
                raise APIConnectionError("Request timeout")
            except httpx.RequestError as e:
                raise APIConnectionError(f"Connection error: {str(e)}")

    @async_retry(max_retries=3, initial_delay=1.0)
    async def complete(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
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

    async def stream(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
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
                        error_text = await response.aread()
                        try:
                            error_data = json.loads(error_text)
                            error_message = error_data.get("error", {}).get(
                                "message", "Unknown error"
                            )
                        except Exception:
                            if isinstance(error_text, bytes):
                                error_message = error_text.decode()
                            else:
                                error_message = str(error_text)

                        if response.status_code == 429:
                            retry_after = int(response.headers.get("Retry-After", 60))
                            raise RateLimitError(error_message, retry_after=retry_after)
                        elif response.status_code >= 500:
                            raise APIConnectionError(f"Server error: {error_message}")
                        else:
                            raise OpenRouterError(
                                error_message, status_code=response.status_code
                            )

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
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 1000,
        **kwargs: Any
    ) -> Any:
        response = await self.complete(
            prompt=prompt,
            system_prompt=system_prompt,
            temperature=temperature,
            max_tokens=max_tokens,
            **kwargs
        )

        try:
            json_text = _extract_json_from_text(response)
            return json.loads(json_text)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON response: {response}")
            raise OpenRouterError(f"Invalid JSON response: {str(e)}", detail=response)


openrouter_client = OpenRouterClient()
