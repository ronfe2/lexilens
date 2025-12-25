import json
from collections.abc import AsyncGenerator
from typing import Any


async def stream_sse_events(
    generator: AsyncGenerator[dict[str, Any], None]
) -> AsyncGenerator[dict[str, Any], None]:
    """
    Normalize event dicts for EventSourceResponse.

    EventSourceResponse expects either:
      - plain dicts like {"data": "...", "event": "name"}
      - ServerSentEvent / JSONServerSentEvent instances

    The LLM orchestrator yields {"event": str, "data": Any}. Previously this
    helper converted those dicts into pre-formatted SSE strings, which caused
    EventSourceResponse to wrap them again and break the client-side parser.

    We now:
      * keep data as JSON text so the frontend can safely JSON.parse it
      * return a simple dict that EventSourceResponse will turn into a proper
        SSE frame: "event: <event>\\ndata: <json>\\n\\n"
    """
    async for event_data in generator:
        event = event_data.get("event", "message")
        data = event_data.get("data", {})

        # Ensure JSON-serializable payload is sent as a JSON string so the
        # frontend's SSE parser can call JSON.parse(...) reliably.
        json_payload = json.dumps(data, ensure_ascii=False)

        yield {
            "event": event,
            "data": json_payload,
        }
