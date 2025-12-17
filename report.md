# LexiLens – Implementation Report

**Date:** 2025-12-17  
**Scope:** Hackathon MVP implementation of LexiLens ("Project Living Sinclair")

---

## 1. Product & Value Proposition

LexiLens is implemented as a **Chrome side-panel coach**, not a traditional dictionary.

**Single value proposition:**  
> Turn every word you notice while reading or writing into an instant coaching moment that moves it from *passive recognition* to *confident, active use*.

Key characteristics of the delivered experience:
- **Embedded in the reading/writing flow** – double-click or select text on any page; the LexiLens side panel slides in instead of sending you to a separate dictionary page.
- **Streaming, multi-layer coaching** – a Cobuild-style “behavior pattern” sentence appears first, then richer layers arrive in real time.
- **Context-aware and personal** – prompts see the full sentence and page type, and the “strategy → tactic” flow showcases personalized scaffolding.
- **Visually futuristic** – glassmorphism UI, micro-animations, lexical map visualization, dark mode, and a compact coach-like header with pronunciation.

This matches the original Sinclair-spec intent but makes the **"AI coach vs. dictionary" distinction much clearer** in both UX and copy.

---

## 2. What Was Implemented

### 2.1 Backend (FastAPI + OpenRouter)

Location: `backend/app`

- **Configuration (`config.py`)**
  - Uses `pydantic-settings` with `.env` support.
  - Key settings:
    - `openrouter_api_key` – required.
    - `openrouter_model_id` – default `anthropic/claude-3.5-sonnet`.
    - `openrouter_base_url` – default `https://openrouter.ai/api/v1`.
    - CORS origins include `chrome-extension://*` and `http://localhost:5173`.

- **OpenRouter client (`services/openrouter.py`)**
  - Single `OpenRouterClient` encapsulating all LLM interaction.
  - Methods:
    - `complete()` – one-shot completion (chat-style).
    - `stream()` – streaming chat completion, parsing OpenRouter SSE frames and yielding content chunks.
    - `complete_json()` – convenience wrapper that calls `complete()` and parses JSON, handling fenced code blocks.
  - Adds required headers (`Authorization`, `HTTP-Referer`, `X-Title`) and robust error types:
    - `OpenRouterError`, `RateLimitError`, `APIConnectionError`.
  - Retries via `async_retry` decorator with exponential backoff.

- **Prompt builder (`services/prompt_builder.py`)**
  - Centralizes the 4-layer prompts:
    1. **Layer 1 – Behavior Pattern**: Cobuild-style, single-sentence definition that cannot repeat the target word.
    2. **Layer 2 – Live Contexts**: 3-json-item array (`twitter`, `news`, `academic`) with `text` and `icon` fields.
    3. **Layer 3 – Common Mistakes**: JSON array of `{ wrong, why, correct }`.
    4. **Layer 4 – Cognitive Scaffolding**: JSON object with `related_words` and optional `personalized` string.
  - **Personalization hook**: if `word == "tactic"` and history contains `"strategy"`, the prompt injects explicit instructions to include a personalized explanation and a `personalized` field in the JSON.

- **LLM orchestrator (`services/llm_orchestrator.py`)**
  - Provides `analyze_streaming(request: AnalyzeRequest)` which:
    - Streams **Layer 1** token-by-token using `OpenRouterClient.stream()` and emits:
      - `layer1_chunk` events for progressive rendering.
      - `layer1_complete` with the full sentence.
    - Runs **Layers 2, 3, 4 in parallel** using `asyncio.create_task` and emits:
      - `layer2`, `layer3`, `layer4` events with Pydantic-validated payloads.
      - Per-layer error events (e.g., `layer2_error`) if parsing or LLM fails.
    - Finally emits a `done` event.

- **Models (`models/request.py`, `models/response.py`)**
  - `AnalyzeRequest`: `{ word, context, page_type?, learning_history? }`.
  - Typed response models for live contexts, mistakes, related words, and SSE-friendly wrappers (`Layer2Response`, etc.).
  - `PronunciationResponse` for IPA + audio URL.

- **Streaming utilities (`utils/streaming.py`)**
  - `stream_sse_events()` converts the orchestrator’s `{event, data}` dicts into correctly formatted `text/event-stream` lines.

- **API routes (`api/routes/analyze.py`, `api/routes/pronunciation.py`)**
  - `POST /api/analyze`
    - Accepts `AnalyzeRequest` JSON.
    - Returns `EventSourceResponse` SSE stream with events: `layer1_chunk`, `layer1_complete`, `layer2`, `layer3`, `layer4`, `*_error`, `done`.
  - `GET /api/pronunciation/{word}`
    - Uses `dictionaryapi.dev` to fetch IPA and audio URL.
    - Graceful fallbacks when phonetics or audio are missing; returns `PronunciationResponse`.

- **Error handling (`utils/error_handling.py`)**
  - Custom exceptions and `async_retry` decorator with exponential backoff, jitter, and rate-limit-aware delays.

- **Tests (`backend/tests/test_prompt_builder.py`)**
  - Focused on Layer 4 personalization behavior (ensuring the special `strategy → tactic` path both sets and omits `"personalized"` appropriately).

### 2.2 Chrome Extension (React + Vite + Tailwind)

Location: `extension/`

- **Manifest V3 (`manifest.json`)**
  - Permissions: `activeTab`, `sidePanel`, `storage`.
  - Background service worker: `src/background/service-worker.ts`.
  - Content script on `<all_urls>`: `src/content/content-script.ts` + CSS.
  - Side panel entry: `src/sidepanel/index.html`.
  - Host permissions: `http://localhost:8000/*` for local backend.

- **Content script (`src/content/content-script.ts`)**
  - Injected into all pages.
  - Detects selections on `mouseup` (short words/phrases) and `dblclick` (stronger intent, no length limit).
  - Builds a context payload:
    - extracts the sentence containing the word and a surrounding window of text via `extractContext()`.
    - detects `pageType` from URL patterns (`news`, `academic`, `social`, `email`, `other`).
  - Sends `WORD_SELECTED` messages to background via `chrome.runtime.sendMessage` (debounced).

- **Background service worker (`src/background/service-worker.ts`)**
  - Receives `WORD_SELECTED` messages and stores the last selection in memory.
  - Opens the side panel for the current window (`chrome.sidePanel.open`).
  - Responds to `SIDE_PANEL_READY` from the side panel by returning the last selection.
  - Also allows manual opening via the extension toolbar icon.

- **Side panel React app (`src/sidepanel/App.tsx`)**
  - Uses Zustand store (`src/store/appStore.ts`) to track:
    - `currentWord`, `analysisResult`, `isLoading`, `error`.
  - Hooks:
    - `useStreamingAnalysis()` – drives SSE streaming and updates layers.
    - `useLearningHistory()` – manages persisted, personalized history in `chrome.storage.local`.
    - `useTheme()` – light/dark mode synced to storage and applies Tailwind `dark` class.
  - On load:
    - Announces `SIDE_PANEL_READY` to background to fetch the last selection.
    - Subscribes to future `WORD_SELECTED` messages for live updates while open.
  - Orchestrates retries, loading states, and error display.

- **Layer UI components (`src/components`)**
  - `Header` – word display, IPA, pronunciation playback (via HTML Audio), theme toggle, optional close button.
  - `BehaviorPattern` – glassmorphism card with Cobuild-style quote block.
  - `LiveContexts` – three cards (social, news, academic) with source-specific icon and background; queried word highlighted in context.
  - `CommonMistakes` – coach-style “wrong vs. correct” cards with red/green visual contrast and explanation.
  - `CognitiveScaffolding` – two-part experience:
    - Lexical mini-graph: radial layout showing base word in center and related words around it, connected via animated SVG lines.
    - Detail cards with relationship tag, key difference, and when-to-use guidance.
    - Optional `personalizedTip` panel for the `strategy → tactic` demo and future personalized flows.
  - `EmptyState`, `ErrorDisplay`, `LoadingSpinner` – dedicated components for initial, error, and in-progress states.

- **Streaming hook (`src/sidepanel/hooks/useStreamingAnalysis.ts`)**
  - Uses `fetch` + `ReadableStream` to consume `text/event-stream` from the backend and a small SSE parser to support the Chrome extension environment.
  - Updates layers incrementally:
    - `layer1_chunk` → progressively lengthening behavior pattern.
    - `layer2`, `layer3`, `layer4` → structured data mapped into TypeScript interfaces.
    - `error` / `*_error` → user-friendly error surface.
  - In parallel, fires a best-effort pronunciation request and enhances the header once ready.

- **Learning history hook (`src/sidepanel/hooks/useLearningHistory.ts`)**
  - Seeds history with `DEMO_LEARNING_HISTORY = [strategy, implement, comprehensive]` for hackathon demo.
  - On first load, tries to read stored history; if none, persists demo seed.
  - `addEntry` updates history while deduplicating and capping length.
  - Exposes a convenient `words` list (lowercased) to send to the backend as `learning_history`.

- **Styling & animations**
  - Tailwind CSS with a glassmorphism utility layer (`.glass`, `.glass-border`).
  - Framer Motion used throughout for smooth entrance animations and hovering coach feel.
  - Dark mode implemented via `useTheme` and Tailwind `dark:` variants.

---

## 3. How It Delivers the "New Paradigm" Coach Experience

- **Coach over dictionary**
  - No dictionary-style definition lists or part-of-speech tables; instead, the first thing the user sees is a **single, living sentence** capturing behavior and typical use.
  - The following layers are explicitly about **usage, mistakes, and next steps**, not static meaning.

- **Real-time, layered magic**
  - LexiLens shows visible “thinking”: Layer 1 streams into place, then the UI quietly “powers up” with live contexts, mistakes, and lexical map.
  - This creates a sense of *ongoing conversation* rather than one-off lookup.

- **Context-aware**
  - Page type detection (news vs. academic vs. social) is wired into the request to shape examples.
  - Full-sentence + neighborhood context helps the LLM generate examples that feel closer to what the user is currently reading.

- **Personalized, growing coach**
  - The demo history + `strategy → tactic` personalization path demonstrates how LexiLens can remember what you’ve explored and adapt explanations.
  - The architecture (learning history hook + LLM prompts) is ready for future personalization strategies (e.g., level, goals, exam prep).

- **Lexical "lens" visualization**
  - The lexical mini-map for Layer 4 makes relational understanding visual: users literally see a word in relation to its neighbors, reinforcing the LexiLens brand metaphor.

Overall, the implemented UX should feel like **turning your current page into an AR overlay for vocabulary**: a soft, animated side lens that reveals how words behave, how they’re misused, and how to grow beyond them.

---

## 4. Setup & Installation

### 4.1 Prerequisites

- **Backend**
  - Python 3.11+
  - `poetry` installed
- **Frontend (extension)**
  - Node.js 18+ (recommended)
  - `pnpm` installed
- **Browser**
  - Google Chrome supporting Manifest V3 and side panel APIs.

### 4.2 Backend (FastAPI + OpenRouter)

1. Navigate to `backend/`:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   poetry install
   ```
3. Create your environment file:
   ```bash
   cp .env.example .env
   ```
4. Edit `.env` and set at least:
   ```env
   OPENROUTER_API_KEY=your_real_openrouter_key
   # Optional overrides
   OPENROUTER_MODEL_ID=anthropic/claude-3.5-sonnet
   API_HOST=0.0.0.0
   API_PORT=8000
   CORS_ORIGINS=["chrome-extension://*", "http://localhost:5173"]
   ```
5. Run the API server:
   ```bash
   poetry run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```
6. Verify it’s up:
   - Visit `http://localhost:8000/health` → should return `{ "status": "healthy" }`.
   - Visit `http://localhost:8000/docs` for interactive API docs.

### 4.3 Chrome Extension

1. Navigate to `extension/`:
   ```bash
   cd extension
   ```
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Create your environment file:
   ```bash
   cp .env.example .env
   ```
4. Ensure `VITE_API_URL` points to your backend:
   ```env
   VITE_API_URL=http://localhost:8000
   VITE_ENV=development
   ```
5. Build the production extension bundle:
   ```bash
   pnpm build
   ```
   This writes a ready-to-load extension into `extension/dist/`.
6. Load the extension in Chrome:
   - Open `chrome://extensions/`.
   - Enable **Developer mode**.
   - Click **Load unpacked** and select the `extension/dist` folder.

### 4.4 Running the Demo Flow

With backend running and the extension loaded:

1. Open a news or academic article (e.g., from The Economist or NYT).
2. Select or double-click a word like `precarious`.
3. Watch the LexiLens side panel:
   - Header shows the word and (once fetched) IPA + pronunciation audio.
   - Layer 1 behavior pattern sentence streams in.
   - Layer 2 Live Contexts cards appear.
   - Layer 3 Common Mistakes cards render.
   - Layer 4 Cognitive Scaffolding shows the lexical mini-map + related-word cards.
4. To show personalization magic:
   - First, query `strategy` on any page.
   - Then query `tactic`.
   - Layer 4 should include a personalized tip explicitly connecting `strategy` and `tactic`.

For a more scripted walkthrough, see `demo-script.md` in the project root.

---

## 5. OpenRouter Configuration Details

All sensitive configuration lives on the backend; the extension never sees the OpenRouter API key.

- **Environment variables (backend)** – defined in `backend/.env.example` and loaded via `app/config.py`:
  - `OPENROUTER_API_KEY` (required)
  - `OPENROUTER_MODEL_ID` (optional; default `anthropic/claude-3.5-sonnet`)
  - `OPENROUTER_BASE_URL` (optional; defaults to `https://openrouter.ai/api/v1`)
  - `API_HOST`, `API_PORT`, `CORS_ORIGINS`, `LOG_LEVEL` for server runtime.

- **HTTP behavior**
  - All LLM calls go through `OpenRouterClient` using the `/chat/completions` endpoint.
  - Requests include:
    - `Authorization: Bearer <OPENROUTER_API_KEY>`
    - `HTTP-Referer: https://lexilens.app` (for OpenRouter analytics)
    - `X-Title: LexiLens`

- **Model selection**
  - Model is globally configured via `OPENROUTER_MODEL_ID` but can be overridden when constructing `OpenRouterClient` if needed.
  - Temperature and `max_tokens` are tuned per layer:
    - Layer 1: shorter, focused (e.g., `max_tokens=300`).
    - Layers 2–4: more generous for multiple examples.

- **Error and rate limit handling**
  - Non-2xx responses are mapped to `OpenRouterError` or `RateLimitError` with `retry_after` support.
  - The `async_retry` decorator adds up to 3 retries with exponential backoff.
  - Frontend surfaces friendly error copy when a layer fails, instead of breaking the entire experience.

---

## 6. Demo Package (Extension ZIP)

A ready-to-share ZIP bundle of the extension has been created at project root:

- `lexilens-extension-dist.zip` – contains the built `dist/` folder from `extension/`.

To rebuild or update this package:

```bash
cd extension
pnpm build
zip -r ../lexilens-extension-dist.zip dist
```

Judges can install directly by unzipping and loading the `dist` directory as an unpacked extension.

---

## 7. Issues, Trade-offs, and Future Improvements

### 7.1 Technical Considerations Encountered

- **SSE in Chrome extension environment**
  - Instead of relying on `EventSource`, the side panel uses `fetch` + manual SSE parsing. This avoids potential MV3 and service worker lifecycle quirks and gives finer control over cancellation and error handling.

- **LLM JSON strictness**
  - Because the prompts request specific JSON shapes, `complete_json()` includes logic to trim code fences and parse safely. Layer-specific validators in `LLMOrchestrator` enforce structure (e.g., exactly 3 contexts for Layer 2), and errors are isolated per layer.

- **Pronunciation fallbacks**
  - Not all words have clean IPA + audio from `dictionaryapi.dev`. The route returns `ipa="N/A"` and `audio_url=None` in those cases; the UI gracefully hides the play button while still showing the word.

- **Personalization scope**
  - For the hackathon MVP, personalization is intentionally limited to the `strategy → tactic` demo path. The architecture supports richer personalization by expanding learning history and prompt instructions in the future.

### 7.2 Possible Next Steps

- Add Chinese explanations layer for bilingual coaching (optional toggle).
- Introduce a “practice mode” (cloze tests, quick writing prompts) directly in the side panel.
- Track per-word mastery and surface spaced-repetition reminders.
- Expand context detection beyond URL heuristics using lightweight page-content classifiers.

---

## 8. How to Hand Off

- **For developers**: Start with `backend/README.md` and `extension/README.md` for quick commands; use this `report.md` plus `spec.md` for deeper architecture understanding.
- **For demo presenters**: Use `demo-script.md` alongside the personalized `strategy → tactic` flow and the lexical map to emphasize the "coach, not dictionary" narrative.

LexiLens is now in a state where a **10-minute live demo** can convincingly show a new, AI-native vocabulary learning paradigm: one that lives *inside* the page and treats every word as an opportunity for real-time coaching rather than a one-off lookup.

