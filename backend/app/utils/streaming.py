import json
from collections.abc import AsyncGenerator
from typing import Any


async def format_sse_event(event: str, data: Any) -> str:
    json_data = json.dumps(data, ensure_ascii=False)
    return f"event: {event}\ndata: {json_data}\n\n"


async def stream_sse_events(
    generator: AsyncGenerator[dict[str, Any], None]
) -> AsyncGenerator[str, None]:
    async for event_data in generator:
        event = event_data.get("event", "message")
        data = event_data.get("data", {})
        yield await format_sse_event(event, data)
