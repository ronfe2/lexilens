import json

import pytest

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

