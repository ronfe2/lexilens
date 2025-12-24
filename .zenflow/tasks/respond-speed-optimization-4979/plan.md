# Full SDD workflow

## Configuration
- **Artifacts Path**: {@artifacts_path} → `.zenflow/tasks/{task_id}`

---

## Workflow Steps

### [x] Step: Requirements
<!-- chat-id: d87332b9-23ee-4c54-9a18-a61710ed487f -->

Create a Product Requirements Document (PRD) based on the feature description.

1. Review existing codebase to understand current architecture and patterns
2. Analyze the feature definition and identify unclear aspects
3. Ask the user for clarifications on aspects that significantly impact scope or user experience
4. Make reasonable decisions for minor details based on context and conventions
5. If user can't clarify, make a decision, state the assumption, and continue

Save the PRD to `{@artifacts_path}/requirements.md`.

### [x] Step: Technical Specification
<!-- chat-id: 18edc0e3-b49f-4910-b17c-2eeb9d6f3090 -->

Create a technical specification based on the PRD in `{@artifacts_path}/requirements.md`.

1. Review existing codebase architecture and identify reusable components
2. Define the implementation approach

Save to `{@artifacts_path}/spec.md` with:
- Technical context (language, dependencies)
- Implementation approach referencing existing code patterns
- Source code structure changes
- Data model / API / interface changes
- Delivery phases (incremental, testable milestones)
- Verification approach using project lint/test commands

### [x] Step: Planning
<!-- chat-id: e74320b9-bc48-438c-97ef-63566d6bea75 -->

Create a detailed implementation plan based on `{@artifacts_path}/spec.md`.

1. Break down the work into concrete tasks
2. Each task should reference relevant contracts and include verification steps
3. Replace the Implementation step below with the planned tasks

Rule of thumb for step size: each step should represent a coherent unit of work (e.g., implement a component, add an API endpoint, write tests for a module). Avoid steps that are too granular (single function) or too broad (entire feature).

If the feature is trivial and doesn't warrant full specification, update this workflow to remove unnecessary steps and explain the reasoning to the user.

Save to `{@artifacts_path}/plan.md`.

### [x] Step: Backend Phase 1 – Analyze SSE and layer selection
<!-- chat-id: 7ecd14cd-7e16-4aa8-9503-ad158cae4a36 -->

Implement backend changes that reduce latency of 解读 / Lexical Map / Common Mistakes while keeping the existing SSE contract compatible.

- Implementation:
  - Update `AnalyzeRequest` in `backend/app/models/request.py` to add optional `layers: Optional[list[int]]` (supporting 2, 3, 4; Layer 1 is always streamed).
  - Update `LLMOrchestrator.analyze_streaming` in `backend/app/services/llm_orchestrator.py` and `/api/analyze` route in `backend/app/api/routes/analyze.py` to:
    - Respect the `layers` filter when deciding which of Layer 2/3/4 to generate.
    - Start Layer 2/3/4 generation tasks concurrently and stream `layer2`/`layer3`/`layer4` SSE events in completion order instead of fixed order (fix the sequential await bug).
    - Preserve existing event names (`layer1_chunk`, `layer1_complete`, `layer2`, `layer3`, `layer4`, `*_error`, `done`) so current extensions keep working.
  - Ensure error handling for individual layers remains robust (a failed layer emits its corresponding `*_error` but does not break other layers).
- Verification:
  - Run `cd backend && poetry run pytest -v` and ensure existing tests pass.
  - Add/extend tests around `analyze_streaming` to cover:
    - Requests with different `layers` values (e.g. `[2]`, `[2,4]`, `[2,3,4]`) and verify only the selected SSE events are emitted.
    - Completion-order streaming of Layer 2/3/4 using mocked LLM responses with different delays.
  - Manual check with a running dev server:
    - Use `curl` or a small client to call `/api/analyze` and confirm Layer 1 still streams first, and Layer 2/3/4 arrive as soon as each is ready.

### [x] Step: Backend Phase 1 – Prompt, token, and model tuning for Layers 2–4
<!-- chat-id: 0bad895a-23d0-4a97-a6a5-5b01142e73d7 -->

Tighten prompts and introduce per-layer model configuration to reduce latency and unnecessary token usage.

- Implementation:
  - Layer 2 (Live Contexts):
    - Update `PROMPT_CONFIG["layer2"]` in `backend/app/prompt_config.py` to remove any requirement for an `icon` field (FR10).
    - Update `generate_layer2` in `backend/app/services/llm_orchestrator.py` and `LiveContext` mapping in `backend/app/models/response.py` so `icon` is no longer parsed from LLM output (always `None`/omitted).
  - Layer 3 (Common Mistakes):
    - Update the Layer 3 prompt in `prompt_config.py` to emphasize short explanations (1–2 Chinese sentences per mistake).
    - Reduce `max_tokens` in `generate_layer3` (e.g. 600 → ~400) while keeping JSON schema unchanged.
    - Extend `generate_layer3` to accept `max_items: int = 2` and slice the parsed list accordingly.
  - Layer 4 (Lexical Map + 解读):
    - Update `PROMPT_CONFIG["layer4"]["user_prompt_template"]` to request “up to 5” related words/phrases instead of exactly 2, prioritizing quality over quantity.
    - Reduce `max_tokens` for Layer 4 responses (e.g. 800 → ~600) and tighten the 解读 instructions for concise 1–3 sentence output.
    - Ensure parsing in `generate_layer4`:
      - Requires at least 1 related word.
      - Caps processed related words at 5 before constructing `RelatedWord` objects.
  - Per-layer model and thinking configuration:
    - Extend `Settings` in `backend/app/config.py` with `openrouter_fast_model_id`, `openrouter_layer3_model_id`, `openrouter_layer4_fast_model_id`, `openrouter_layer4_main_model_id`, and `*_thinking_enabled` flags as described in the spec.
    - Add a `_model_for(layer: str)` helper and wire it into `generate_layer2`, `generate_layer3`, and `generate_layer4` (and later `generate_layer4_candidates`), falling back to `openrouter_model_id` when no override is set.
    - Pass reasoning/thinking flags only when the corresponding `*_thinking_enabled` flag is true.
- Verification:
  - Run `cd backend && poetry run pytest -v` and ensure all tests pass.
  - Add/extend unit tests for:
    - `generate_layer2` ignoring `icon` values returned by the LLM.
    - `generate_layer3` honoring `max_items` and still returning valid `Layer3Response`.
    - `generate_layer4` capping related words at 5 and handling cases with fewer than 5 items gracefully.
    - `_model_for` selection behavior and that per-layer model overrides are respected.
  - Smoke test `/api/analyze` end-to-end to confirm:
    - Layer 2 still renders correctly without `icon`.
    - Layer 3 and Layer 4 responses remain valid JSON and shorter on average.

### [x] Step: Backend Phase 2 – New endpoints for deferred Common Mistakes and Lexical Map text
<!-- chat-id: 52319f0e-cba1-40b4-bb83-b214fed957a5 -->

Expose non-SSE endpoints that allow the frontend to fetch Common Mistakes and Lexical Map text data lazily.

- Implementation:
  - Common Mistakes:
    - Add `CommonMistakesRequest` to `backend/app/models/request.py` with fields `word`, `context`, and optional `english_level`.
    - Add a new route (in `backend/app/api/routes/analyze.py` or a dedicated `mistakes.py`) exposing `POST /api/analyze/mistakes` returning `Layer3Response`.
    - Inside this route, call `llm_orchestrator.generate_layer3` with `max_items=2` and forward errors via existing HTTP error-handling helpers in `backend/app/utils/error_handling.py`.
  - Lexical Map text:
    - Add `LexicalMapTextRequest` to `backend/app/models/request.py` with fields as defined in the spec (word, context, learning history, english level, interests, blocked_titles, favorite_words).
    - Extend `backend/app/api/routes/lexical_map.py` with `POST /api/lexical-map/text` returning `Layer4Response`.
    - Route should call `llm_orchestrator.generate_layer4` and reuse existing Lexical Map orchestration logic.
  - Ensure these endpoints reuse the same models (`Layer3Response`, `Layer4Response`, `RelatedWord`, `CommonMistake`) to stay consistent with `/api/analyze`.
- Verification:
  - Add FastAPI test-client tests in `backend/tests` to cover:
    - Happy-path and error-path responses for `/api/analyze/mistakes`.
    - Happy-path and error-path responses for `/api/lexical-map/text`.
    - Shape compatibility with existing `Layer3Response` and `Layer4Response` contracts.
  - Run `cd backend && poetry run pytest -v` and confirm the new tests pass.
  - Manual QA against a running dev server:
    - Use `curl`/HTTP client to call both new endpoints with realistic payloads and confirm latency and response shape.

### [x] Step: Backend Phase 3 – Lexical Map two-stage strategy (optional stretch)
<!-- chat-id: 0e70c904-1442-4794-8715-80edc4a49325 -->

Prepare a two-stage Lexical Map pipeline using a fast model for candidate recall and the main model for rich labeling and personalized coaching.

- Implementation:
  - In `backend/app/services/llm_orchestrator.py`, add:
    - `generate_layer4_candidates` that uses a fast model (`openrouter_layer4_fast_model_id` or `openrouter_fast_model_id`) with a lightweight prompt `PROMPT_CONFIG["layer4_candidates"]` to recall up to 5 related words.
    - `enrich_layer4_from_candidates` that takes the candidate list plus context and uses the main model (`openrouter_layer4_main_model_id` or default) to produce full `Layer4Response` including differences, usage notes, and personalized coaching.
  - Refactor `generate_layer4` to orchestrate Stage A then Stage B while preserving the existing `Layer4Response` contract.
  - Extend `prompt_config.py` with a new `layer4_candidates` prompt tailored for fast candidate recall.
  - Keep Lexi Learner’s image warmup behavior intact by ensuring `/api/lexical-map/image` and related selection logic are unaffected.
- Verification:
  - Add unit tests for:
    - `generate_layer4_candidates` returning at least one candidate and capping at 5.
    - `enrich_layer4_from_candidates` producing a valid `Layer4Response` from a mocked candidate list.
    - `generate_layer4` delegating correctly and still satisfying existing tests that assert on `Layer4Response`.
  - Run `cd backend && poetry run pytest -v`.
  - Optional manual profiling:
    - Compare Lexical Map latency before/after enabling two-stage strategy using sample words and contexts.

### [x] Step: Frontend Phase 2 – Support layer selection and new endpoints
<!-- chat-id: 8b18251c-e2fc-460f-9187-e8dac467a223 -->

Wire the Chrome extension to take advantage of selective layers and the new backend endpoints without regressing current UX.

- Implementation:
  - Types and request payload:
    - Update `AnalysisRequest` and related types in `extension/src/shared/types.ts` to include optional `layers?: number[]`.
    - Default to requesting `[2,3,4]` for compatibility; later experiments can switch to `[2,4]` to defer Common Mistakes.
  - Streaming hook:
    - Update `extension/src/sidepanel/hooks/useStreamingAnalysis.ts` to send the `layers` field in the `/api/analyze` request body when present.
    - Keep SSE event handling logic for `layer1_chunk`, `layer1_complete`, `layer2`, `layer3`, `layer4`, and `done` unchanged so existing UI behavior is preserved.
  - Common Mistakes deferred loading:
    - In `extension/src/components/CommonMistakes.tsx` (and `appStore.ts` if needed), add support for:
      - Showing a loading skeleton or “点击生成常见错误” state when `analysisResult.layer3` is missing but Common Mistakes should be displayed.
      - On first view or user click, calling `/api/analyze/mistakes` with the current `(word, context, englishLevel)` and updating `analysisResult.layer3` via store utilities (e.g., `updateAnalysisLayer`).
  - Lexical Map text endpoint:
    - Prepare `CognitiveScaffolding.tsx` to optionally fetch `/api/lexical-map/text` when the Lexical Map section becomes visible or when a user interacts, using the same payload fields as `/api/analyze`.
    - Ensure the Lexi Learner warmup logic and `/api/lexical-map/image` usage remain unchanged.
- Verification:
  - Run `cd extension && pnpm lint && pnpm typecheck`.
  - Manual tests in a dev browser session:
    - Confirm the current flow still works when `layers` is omitted (backward compatible).
    - With `layers=[2,4]`, verify:
      - Layer 2 and Layer 4 content appear promptly.
      - Common Mistakes load only when the section is viewed or clicked, using `/api/analyze/mistakes`.
    - Check that the Lexi Learner image warmup still fires quickly and that new endpoints do not slow down initial UI rendering.

### [x] Step: Frontend Phase 3 – Lexical Map UX refinements (optional stretch)
<!-- chat-id: e81a40a2-6cbe-4098-9e5a-4706bd42a180 -->

Optionally evolve the Lexical Map UI to use candidate-first data and reduce perceived latency.

- Implementation:
  - In `CognitiveScaffolding.tsx`:
    - Continue to slice `relatedWords` to the 4 available node positions, even if up to 5 are returned.
    - When only candidate-level data is available (from Stage A), display the node graph with basic labels and a hint such as “点击某个节点加载详细区别”.
    - Once enriched Stage B data is available (via SSE or `/lexical-map/text`), hydrate `keyDifference` / `whenToUse` fields without reloading the graph.
  - In `CoachSummary.tsx`, consider:
    - Showing a short skeleton (“正在为你整理解读…”) while personalized 解读 is loading, if the backend moves to deferred loading for that field.
  - Keep the Lexi Learner warmup behavior unchanged, ensuring manga image load speed is not impacted by any new UI logic.
- Verification:
  - Run `cd extension && pnpm lint && pnpm typecheck`.
  - Manual UX validation:
    - Confirm Lexical Map nodes appear quickly, even if detailed differences arrive later.
    - Ensure there are no regressions in how 解读 and Lexical Map are displayed compared to the current implementation.

### [x] Step: End-to-end QA and performance validation
<!-- chat-id: ddce109d-0fca-43a5-8197-0d149c0414c8 -->

Validate that the overall feature meets the latency and UX goals while remaining stable.

- Implementation:
  - Deploy or run the backend and extension together in a dev environment.
  - Use realistic words, contexts, and user profiles (including interests, learning history, and favorites) to exercise:
    - Baseline flow with all layers requested.
    - Experimental flow with deferred Common Mistakes and/or Lexical Map text.
  - Monitor backend logs for slow requests and any errors from the new endpoints.
- Verification:
  - Backend:
    - `cd backend && poetry run pytest -v` and `poetry run ruff check app/`.
  - Frontend:
    - `cd extension && pnpm lint && pnpm typecheck`.
  - Manual:
    - Confirm P50 time to first Layer 1 chunk is within ~1.5s and P50 time for 解读 / Lexical Map / Common Mistakes is within ~5s in a typical dev environment.
    - Verify the system handles failures of deferred requests gracefully (e.g., Lexical Map or Common Mistakes errors do not break the rest of the coaching experience).

### [x] Step: 部分优化
<!-- chat-id: cdc692a7-4f01-4fe4-8026-1ec48c61a1c0 -->

1. 将解读部分的内容改为流式输出
2. Lexical Map 部分的 Graph 图谱显示有问题，节点和边有错位，优化这个图谱的 view 层布局
3. Common Mistakes ，如果用户不点击「生成」，就不用生成，只有用户点了生成，再请求
4. Loading 时，Lexical Map 也要显示

### [x] Step: Backend config – document new latency tuning settings

Update `backend/.env.example` to list, as commented examples, all newly added configuration options from this optimization (per-layer fast models and thinking flags) so they are discoverable without changing defaults.
