# Respond Speed Optimization – PRD

## 1. Background & Current Behavior

LexiLens is a Chrome side-panel coach that streams a multi-layer explanation for a selected word or phrase via the backend `POST /api/analyze` SSE endpoint.

On today’s flow:
- Frontend (`extension/`):
  - `useStreamingAnalysis` starts an analysis when the user selects a word.
  - The backend streams:
    - `layer1_chunk` / `layer1_complete` → behavior pattern sentence (English).
    - `layer2` → “Live Contexts” (3 example sentences).
    - `layer3` → “Common Mistakes” list.
    - `layer4` → “Cognitive Scaffolding” (Lexical Map + personalized Chinese coaching).
  - UI composition in `App.tsx`:
    - Header + pronunciation.
    - `BehaviorPattern` (Layer 1).
    - `CoachSummary` (“解读”) uses `analysisResult.layer4.personalizedTip`.
    - `CognitiveScaffolding` (“Lexical Map” text graph) uses `analysisResult.layer4.relatedWords`.
    - `CommonMistakes` uses `analysisResult.layer3`.
    - A separate `CognitiveScaffolding` flow calls `POST /api/lexical-map/image` to generate a manga-style image on demand; for the Lexi Learner demo profile, there is an asynchronous warmup prefetch.
- Backend (`backend/app/`):
  - `LLMOrchestrator.analyze_streaming`:
    - Streams Layer 1 first.
    - After Layer 1 completes, concurrently runs `generate_layer2`, `generate_layer3`, `generate_layer4` (each hitting OpenRouter once via `complete_json`).
    - Emits `layer2`, `layer3`, `layer4` events when ready, plus per-layer error and `done`.
  - `OpenRouterClient` uses a single configurable model (`openrouter_model_id`, default `anthropic/claude-3.5-sonnet`) for all text tasks.
  - Lexical Map image endpoint `/api/lexical-map/image` uses a (possibly separate) image model and has an in-memory cache with 6h TTL.

From the user’s perspective, after they trigger a lookup:
- Layer 1 usually arrives first, but the **“解读” section (CoachSummary), Lexical Map graph, and Common Mistakes** depend on full Layer 3 and Layer 4 responses.
- These later layers can take many seconds (reported “十几秒” in some cases) before UI sections appear, especially on slower connections or when the model is under load.
- All rich layers (contexts, mistakes, lexical map + personalized summary) are requested **unconditionally** on every analysis, even if the user never scrolls to those sections.

## 2. Problem Statement

The current feature delivers good coaching quality but suffers from **high perceived latency**:
- “解读” (Chinese personalized explanation from Layer 4), **Lexical Map**, and **Common Mistakes** often arrive only after 10+ seconds.
- The side panel shows some feedback early (streamed Layer 1), but the sections that feel most “magical” to users (解读 + Lexical Map + 常见错误) feel sluggish and sometimes “stuck”.
- Some heavy LLM calls may be overkill for initial UX; the system requests full content for all layers even when not needed immediately.

We want to **significantly reduce time-to-meaningful-feedback**, especially:
- The time before the user sees 解读 (personalized coaching).
- The time before a usable Lexical Map appears.
- The time before at least one Common Mistake is displayed.

## 3. Goals & Success Criteria

Primary goals:
- G1: Reduce **first meaningful response latency** for word explanation:
  - User should see **Layer 1 behavior pattern** within ~1–2 seconds in typical conditions.
  - User should see **at least one of 解读 / Lexical Map / Common Mistakes** within ~3–5 seconds for most requests.
- G2: Reduce **overall waiting time** for Lexical Map and Common Mistakes:
  - Lexical Map text nodes (related words) should be available and interactive noticeably faster than today.
  - Common Mistakes should show at least one mistake quickly, even if additional enrichment arrives later.
- G3: Avoid wasting model calls:
  - Do not compute heavy layers if the user never accesses the corresponding UI sections.
- G4: Keep the **Lexi Learner image warmup behavior** for the demo/profile to preserve perceived speed for manga explanations.

Secondary goals:
- G5: Enable **per-layer model choices** (fast vs. smart), so that:
  - Lexical Map candidate retrieval and/or Common Mistakes can use a faster/smaller model when acceptable.
  - “Thinking”/reasoning-heavy behavior can be disabled for steps where it is not needed.
- G6: Make it possible for Lexical Map to **return more candidates**:
  - Backend should be able to recall up to ~5 related words, allowing a “small model recall → big model re-rank/filter” pattern.

Non-goals (for this iteration):
- N1: Redesigning the entire UX layout of the side panel.
- N2: Changing the core explanation style or language (e.g., switching 解读 to English).
- N3: Implementing full analytics/observability pipelines (basic logging & counters are in scope).
- N4: Optimizing the separate pronunciation endpoint (already best-effort & reasonably fast).

## 4. Target Users & Scenarios

- Primary users:
  - Chinese learners of English using LexiLens while reading news, academic texts, or social media.
  - Demo audiences using the Lexi Learner profile in presentations or onboarding.
- Key scenarios:
  - S1: User double-clicks a word in a long article → expects a quick, trustworthy explanation and “解读”.
  - S2: User explores Lexical Map to understand nuances and picks different related nodes, sometimes generating a manga explanation.
  - S3: User scans Common Mistakes to avoid typical errors and correct their own sentence.

In all scenarios, **latency and smoothness** are crucial to perceived quality; long delays break the “coach in your reading flow” feeling.

## 5. Functional Requirements

### 5.1 Streaming & Layering

FR1. The system must continue to stream Layer 1 (behavior pattern) as it does today; no regressions in the current streaming experience.

FR2. The system should support **decoupling heavy layers** (Layer 3 and Layer 4, possibly Layer 2) from the initial `analyze` request, so that:
- Backend can optionally skip or defer certain layers.
- Frontend can explicitly request heavy layers later (e.g., when the relevant section scrolls into view or when the user clicks a tab).

FR3. The frontend must still present a coherent experience:
- Users should not see permanently empty sections; instead, they should see either:
  - Loading skeletons / “点击加载解读” style affordances, or
  - Data filled in when background requests complete.

### 5.2 Lexical Map (Layer 4 + Image)

FR4. Lexical Map text data:
- Backend must be able to return **up to 5 related words** for a given headword and context.
- Frontend may still display a subset (e.g., 4 nodes) but should be able to access all returned candidates for ordering / future expansion.

FR5. Lexical Map generation should support a **two-stage strategy** (design detail to be finalized in the technical spec):
- Stage A: Fast recall of multiple related candidates (small/faster model, no heavy “thinking”).
- Stage B: Higher-quality labeling and explanation for the subset actually shown (standard model, potentially with richer instructions).

FR6. Lexical Map’s personalized Chinese coaching (“personalizedTip” / 解读) should be available faster:
- Either by:
  - Generating a lightweight version early (e.g., using a fast model), or
  - Decoupling it so the rest of the Lexical Map can render without waiting for heavy personalization logic.

FR7. Lexical Map image:
- The existing `/api/lexical-map/image` endpoint and **Lexi Learner warmup flow must remain functional**.
- Warmup prefetch (fire-and-forget) should continue to trigger for Lexi Learner and should not block any other responses.

### 5.3 Common Mistakes (Layer 3)

FR8. Common Mistakes should be available faster:
- System should be able to return **at least one mistake quickly**, even if the target remains two mistakes total.
- It should be possible to adjust the number of mistakes and prompt complexity for speed experiments (e.g., 1 vs 2 mistakes).

FR9. If Common Mistakes are deferred to a secondary request:
- API must expose a dedicated way to request mistakes for a given `(word, context, english_level)` tuple.
- Frontend must trigger this only when the user actually views the Common Mistakes section.

### 5.4 Avoiding Unused/Excess Data

FR10. The backend should avoid generating fields that the frontend never uses, where it materially impacts latency or model cost. Examples to validate:
- Layer 2 `icon` field in `LiveContext` is currently unused on the frontend (the UI derives icons from `source`).
- Any extra descriptive fields in Layer 4 that are not surfaced in the UI.

FR11. The system must be flexible enough so that if the frontend later adds UI for a field, we can re-enable the corresponding generation without large refactors.

### 5.5 Model Selection & “Thinking” Modes

FR12. The system must support **per-layer model configuration**, e.g.:
- `model_fast` for lightweight tasks (candidate recall, simple mistake generation).
- `model_default` for quality-critical tasks (behavior pattern, final Lexical Map explanations, personalized Chinese copy).

FR13. It must be possible to disable any special “thinking” / reasoning modes (e.g. long chain-of-thought or `thinking`-style parameters) on a per-call basis to improve latency and cost where detailed reasoning is unnecessary.

FR14. Model choices and “thinking” flags should be configurable via environment or simple config constants so they can be tuned without code changes.

## 6. Non-Functional Requirements

NFR1. **Performance targets** (initial iteration, non-strict SLAs):
- P50 time to first Layer 1 chunk: ≤ 1.5s (typical dev/test environment with reasonable network).
- P50 time to first appearance of 解读 / Lexical Map / Common Mistakes: ≤ 5s.
- P90 for heavy sections: ideally < 10s; operations exceeding this should log warnings for future tuning.

NFR2. **Reliability**:
- If a deferred or secondary request for Lexical Map or Common Mistakes fails, the rest of the coaching experience should remain usable (Behavior Pattern + Live Contexts).
- Errors should be surfaced to the user in a friendly way and logged server-side with enough context (word, page type, model id).

NFR3. **Backward compatibility**:
- Existing Chrome extension builds should not completely break if the backend is deployed first.
  - At minimum, the `/api/analyze` streaming contract must still behave in a compatible way, or the extension must be updated in lockstep with backend changes.

NFR4. **Cost awareness**:
- Any introduction of additional calls (e.g., two-stage Lexical Map) must be offset by:
  - Using cheaper models for some stages, or
  - Skipping calls when sections are not used.

## 7. Constraints & Considerations

- Warmup / Lexi Learner:
  - The Lexi Learner profile has special warmup behavior for Lexical Map images; this must be preserved and should not be made slower.
- Browser environment:
  - SSE streaming is implemented manually with `fetch` + `ReadableStream`, so any protocol changes must preserve this compatibility.
- Prompt complexity:
  - Some current prompts are long and heavily constrained; simplification may be a key lever for latency, but must be done carefully to avoid quality degradation.
- Internationalization:
  - Explanations for 解读 and Common Mistakes are in Simplified Chinese; any change in model or prompt must keep language and tone consistent.

## 8. Open Questions & Assumptions

Open questions (for product/owner clarification):
1. **Acceptable trade-offs between speed and richness**  
   - For “解读” and Lexical Map, how much detail can we safely shave off to gain speed?  
   - Is it acceptable if the first version of 解读 is shorter/rougher but arrives faster, with a richer version optionally loaded later?
2. **Perceived vs. actual latency targets**  
   - Are there concrete time thresholds from user testing (e.g., “>8s feels broken”)?  
   - Do we prioritize P50 or worst-case outliers?
3. **Lexical Map candidate count**  
   - You suggested “最多五个” related words. Do you want:
     - Exactly 5 candidates when possible, or
     - “Up to 5, prioritize quality over quantity”?
4. **Lazy loading strategy**  
   - Is it acceptable for Common Mistakes and Lexical Map to load only when the user scrolls to them, even if that means a small delay at first view, but no cost for users who never scroll?

Assumptions (for this PRD; can be revised):
- A1. The main user pain is **perceived slowness** after clicking a word, not small differences in explanation richness.
- A2. It is acceptable to introduce additional API endpoints (e.g., dedicated endpoints for mistakes and lexical map) as long as the Chrome extension is updated accordingly.
- A3. Using a smaller, faster model (e.g., for initial candidate recall) is acceptable as long as the final visible explanations remain trustworthy and clear.
- A4. The environment can be configured with multiple OpenRouter model ids and optional image model ids without significant operational friction.

---

This PRD defines the product-facing requirements for improving response speed of 解读, Lexical Map, and Common Mistakes while preserving the existing Lexi Learner warmup behavior and overall coaching quality. The next step is to translate these into a technical specification and concrete implementation plan.

