# Investigation: Frontend not displaying LLM response

## Bug summary
- Report: "现在后端大模型能返回，但返回后前端没有内容展示，看下问题"  
  (Backend large model returns successfully, but the frontend shows no content.)
- Actual project code lives in the sibling worktree `../project-initialization-204f`:
  - Backend: `backend/app/...`
  - Chrome extension frontend: `extension/src/...`
- The sidepanel UI (`extension/src/sidepanel/App.tsx`) uses a custom hook `useStreamingAnalysis` to consume an SSE stream from the backend (`/api/analyze`) and progressively update the UI with 4 layers of analysis.
- The backend endpoint `/api/analyze` streams events from `LLMOrchestrator.analyze_streaming()` via `EventSourceResponse` and a helper `stream_sse_events`.

In the browser, the network request to `/api/analyze` succeeds and data is streamed, but the React state in the sidepanel never updates, so the user sees only the empty state or loading, with no actual analysis content rendered.

## Root cause analysis (confirmed)

### Data flow overview
- Frontend:
  - `useStreamingAnalysis` (`extension/src/sidepanel/hooks/useStreamingAnalysis.ts`) calls:
    ```ts
    const response = await fetch(`${API_URL}/api/analyze`, { ... });
    ```
    and manually parses the `text/event-stream` response with:
    ```ts
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    // ...
    const parsed = parseSSEEvent(rawEvent);
    ```
  - `parseSSEEvent` expects raw chunks that look like standard SSE frames:
    ```text
    event: layer1_chunk
    data: { ...json... }

    ```
    It:
    - Extracts `eventName` from `event:` lines.
    - Concatenates `data:` lines into a JSON string and `JSON.parse`s it.
    - Returns `{ event, data }`.
  - `handleEvent` then switches on `event` (`layer1_chunk`, `layer2`, `layer3`, `layer4`, `done`, etc.) and updates the Zustand store via `updateAnalysisLayer`, which drives the UI.

- Backend:
  - `LLMOrchestrator.analyze_streaming` (`backend/app/services/llm_orchestrator.py`) yields dicts like:
    ```python
    {"event": "layer1_chunk", "data": {"content": chunk}}
    {"event": "layer2", "data": {...}}
    {"event": "done", "data": {}}
    ```
  - `stream_sse_events` (`backend/app/utils/streaming.py`) takes that generator and **manually formats raw SSE text**:
    ```python
    async def format_sse_event(event: str, data: Any) -> str:
        json_data = json.dumps(data, ensure_ascii=False)
        return f"event: {event}\ndata: {json_data}\n\n"

    async def stream_sse_events(generator) -> AsyncGenerator[str, None]:
        async for event_data in generator:
            event = event_data.get("event", "message")
            data = event_data.get("data", {})
            yield await format_sse_event(event, data)
    ```
  - The `/api/analyze` route (`backend/app/api/routes/analyze.py`) wraps this with `EventSourceResponse` from `sse_starlette`:
    ```python
    async def event_generator():
        async for sse_data in stream_sse_events(llm_orchestrator.analyze_streaming(request)):
            yield sse_data

    return EventSourceResponse(event_generator(), media_type="text/event-stream", ...)
    ```

### Where things go wrong
- `EventSourceResponse` does **its own** SSE formatting. For each item yielded by the generator, it calls `ensure_bytes(data, sep)` where:
  - If `data` is a `dict`, it is converted to a `ServerSentEvent` with an `event` field and `data` field.
  - If `data` is a plain string (our case), it wraps it as **SSE `data:` only**, with no `event:` field, e.g.:
    ```text
    data: event: layer1_chunk
    data: data: {"content": "..."}

    ```
- This means the browser actually receives SSE frames whose *payload* is the literal text `"event: layer1_chunk\ndata: {...}"`, not proper SSE `event:` / `data:` lines.
- On the frontend:
  - `parseSSEEvent` sees lines starting with `data:` (e.g. `"data: event: layer1_chunk"`), **never** a line starting with `event:`, so `eventName` stays at the default `"message"`.
  - It concatenates all `data:` lines into `dataStr`, which now looks like:
    ```text
    event: layer1_chunk
    data: {"content": "..."}
    ```
    This is not valid JSON, so `JSON.parse` throws and is swallowed, leaving `data` as `undefined`.
  - The hook therefore returns `{ event: 'message', data: undefined }` for every frame.
  - In `handleEvent`, there are explicit cases for `'layer1_chunk'`, `'layer2'`, `'layer3'`, `'layer4'`, `'done'`, etc., but **no case for `'message'`**, so all frames hit the `default` branch and are ignored.
- Result: the backend *does* stream data, but the sidepanel never updates `analysisResult`, and the user sees no content.

## Affected components (confirmed)
- Backend:
  - `backend/app/api/routes/analyze.py` – wraps the streaming generator with `EventSourceResponse`.
  - `backend/app/utils/streaming.py` – manually formats SSE strings, which conflicts with `EventSourceResponse`’s own SSE encoding.
  - `backend/app/services/llm_orchestrator.py` – defines the logical event names and payloads (`layer1_chunk`, `layer1_complete`, `layer2`, `layer3`, `layer4`, `*_error`, `done`).
- Frontend (Chrome extension):
  - `extension/src/sidepanel/hooks/useStreamingAnalysis.ts` – parses SSE and updates the app store; currently assumes correct SSE framing.
  - `extension/src/store/appStore.ts` – stores `AnalysisResult` and drives the sidepanel UI.
  - UI components that depend on `analysisResult`:
    - `BehaviorPattern` (`extension/src/components/BehaviorPattern.tsx`)
    - `LiveContexts` (`extension/src/components/LiveContexts.tsx`)
    - `CommonMistakes` (`extension/src/components/CommonMistakes.tsx`)
    - `CognitiveScaffolding` (`extension/src/components/CognitiveScaffolding.tsx`)
    - `Header`, `EmptyState`, `ErrorDisplay`, `LoadingSpinner`

## Proposed solution and next steps

### 1. Fix the SSE framing on the backend (preferred)
Goal: Let `EventSourceResponse` handle SSE formatting so the frontend receives standard SSE frames that `parseSSEEvent` already understands.

Concrete changes (high level):
- Change `stream_sse_events` to yield **dicts** (or `ServerSentEvent` instances) instead of preformatted SSE strings. For example:
  - Option A – remove `stream_sse_events` entirely and in `analyze_word` do:
    ```python
    async def event_generator():
        async for event_data in llm_orchestrator.analyze_streaming(request):
            yield event_data  # dict with "event" and "data"
    ```
    letting `EventSourceResponse` convert each dict into proper SSE.
  - Option B – keep the helper but make it yield `{"event": event, "data": data}` or `ServerSentEvent(event=event, data=json.dumps(data))` rather than raw `str`.
- After this change, the browser will receive SSE frames like:
  ```text
  event: layer1_chunk
  data: {"content": "..."}

  event: layer2
  data: {"contexts": [...]}
  ```
  which `parseSSEEvent` already handles correctly.

### 2. (Optional safety net) Harden the frontend SSE parser
Even after fixing the backend, it may be worth making `parseSSEEvent` more defensive so future backend changes don’t silently break the UI:
- Detect the “double-wrapped” pattern where `dataStr` itself starts with `"event:"` and, in that case, re-parse it as a nested SSE block.
- Log a warning (in `console.warn`) whenever JSON parsing fails, to make similar issues visible during development.

### 3. Verification plan
After implementing the backend fix (and any optional frontend hardening):
- Start the backend (`poetry run uvicorn app.main:app ...`) and extension (build & load).
- In Chrome:
  - Open a page, select/double-click a word to trigger LexiLens.
  - Confirm in the Network tab that `/api/analyze` streams events with proper `event:` / `data:` lines.
  - Observe that:
    - The behavior pattern (Layer 1) streams into the sidepanel.
    - Live contexts, common mistakes, and cognitive scaffolding appear once their layers complete.
    - Pronunciation appears in the header when available.
- (Optional) Add a minimal backend test that exercises `analyze_streaming` and `EventSourceResponse` together, asserting that at least one event with `event: layer1_chunk` and valid JSON `data:` is produced.

This gives us a clear, concrete path for the implementation step: adjust the backend SSE generator to align with `EventSourceResponse`, and keep the frontend streaming hook as-is (with minor hardening if desired).
