# Spec-3a: 图片解释（Lexical Map Image Explanation）

## 1. Feature Overview & Requirements

- Current behavior: In the Lexical Map (词汇地图) section of the side panel (`CognitiveScaffolding`), clicking a node shows a text card explaining:
  - 关键区别 (`keyDifference`)
  - 使用场景 (`whenToUse`)
- New behavior:
  - Add a `图片解释` button under this text card (only when a node is selected).
  - On click, call a backend endpoint that:
    - Uses an OpenRouter image-capable model (model id configured in backend `.env`).
    - Sends a prompt based on the template:
      > Draw an XKCD style colored manga depicting and explaining the difference between the word "{word_1}" and "{word_2}" to learners using English, with "LexiLens" written at the bottom right corner without any logos or icons
    - Inserts the currently selected base word and related word into `{word_1}` / `{word_2}`.
    - Returns a single generated image.
  - When the image is returned, show it in place of the previous text card area (same layout region under the lexical map).
  - Handle loading state and error state gracefully inside the component without breaking the rest of the analysis view.

Complexity assessment: **medium** (new backend endpoint + OpenRouter integration + frontend UX and local state, but reuses existing patterns and infrastructure).

---

## 2. Technical Context

### Backend

- Stack: Python 3.11+, FastAPI, httpx, Pydantic, sse-starlette.
- Config: `backend/app/config.py` using `pydantic-settings`; existing OpenRouter config:
  - `openrouter_api_key`
  - `openrouter_model_id` (chat LLM, default `anthropic/claude-3.5-sonnet`)
  - `openrouter_base_url` (default `https://openrouter.ai/api/v1`)
- OpenRouter wrapper: `backend/app/services/openrouter.py`
  - `OpenRouterClient.complete(...)` → one-shot chat completion (`/chat/completions`).
  - `OpenRouterClient.stream(...)` → streaming chat completion.
  - `OpenRouterClient.complete_json(...)` → completion + JSON parsing.
  - Error handling via `OpenRouterError`, `RateLimitError`, `APIConnectionError`, `async_retry`.
- Orchestrator: `backend/app/services/llm_orchestrator.py`
  - Uses `OpenRouterClient` to generate four layers of analysis but **no image generation yet**.
- API:
  - `/api/analyze` (SSE streaming).
  - `/api/pronunciation/{word}` (dictionary API + in-memory cache).

### Frontend (Chrome extension)

- Stack: React 18 + TypeScript, Vite, TailwindCSS, Framer Motion, Zustand.
- API base URL: `extension/src/shared/constants.ts` (`API_URL` / `VITE_API_URL`).
- Analysis data flow:
  - `useStreamingAnalysis` hook (`extension/src/sidepanel/hooks/useStreamingAnalysis.ts`) consumes SSE from `/api/analyze`.
  - Layer 4 (`CognitiveScaffolding`) is mapped to:
    ```ts
    export interface RelatedWord {
      word: string;
      relationship: 'synonym' | 'antonym' | 'broader' | 'narrower' | 'collocate';
      keyDifference: string;
      whenToUse: string;
    }

    export interface CognitiveScaffolding {
      relatedWords: RelatedWord[];
      personalizedTip?: string;
    }
    ```
  - `CognitiveScaffolding` component (`extension/src/components/CognitiveScaffolding.tsx`) renders the lexical map and the text card for the selected related word.

---

## 3. Implementation Approach

### 3.1 Backend: Image Generation Endpoint

#### 3.1.1 Configuration

- Extend `backend/app/config.py`:
  - Add optional image model setting:
    ```py
    openrouter_image_model_id: str | None = None
    ```
  - This is read from `.env` via `OPENROUTER_IMAGE_MODEL_ID`.
- Behavior:
  - If `OPENROUTER_IMAGE_MODEL_ID` is set, use it for image generation.
  - If not set, fall back to `openrouter_model_id` (chat model) but log a warning; if the underlying model does not support images, OpenRouter will return an error which we surface cleanly.

#### 3.1.2 OpenRouter client: image helper

- Extend `OpenRouterClient` in `backend/app/services/openrouter.py`:
  - Add an `image_model_id` attribute:
    ```py
    self.image_model_id = settings.openrouter_image_model_id or self.model_id
    ```
  - Implement a new method, decorated with `@async_retry`, e.g.:
    ```py
    async def generate_image(
        self,
        prompt: str,
        model_id: str | None = None,
        temperature: float = 0.7,
    ) -> str:
        """
        Call OpenRouter image-capable model and return a single image URL
        (typically a data: URL).
        """
    ```
- Request shape:
  - Use the same `/chat/completions` endpoint as `complete`, but include image modalities, following OpenRouter’s image docs:
    - `model`: `model_id or self.image_model_id`
    - `messages`: `[{ "role": "user", "content": prompt }]`
    - `modalities`: `["text", "image"]` (or `["image", "text"]` depending on API expectations).
    - `stream`: `False` (no streaming for images).
    - No need for large `max_tokens` since we mainly care about the image; defaults or a small limit are sufficient.
- Response parsing:
  - Expect a JSON payload similar to:
    ```json
    {
      "choices": [
        {
          "message": {
            "content": "...",
            "images": [
              { "type": "output_image", "image_url": { "url": "data:image/jpeg;base64,..." } }
            ]
          }
        }
      ]
    }
    ```
  - Extract the first `image_url.url` string.
  - If no image is present, raise `OpenRouterError("No image received from OpenRouter")`.
  - Reuse `_handle_error_response` and existing exception classes for non-200 responses.

#### 3.1.3 Request/response models

- In `backend/app/models/request.py`, add:
  ```py
  class LexicalImageRequest(BaseModel):
      base_word: str = Field(..., description="Main word in the lexical map")
      related_word: str = Field(..., description="Selected related word from the lexical map")
  ```
- In `backend/app/models/response.py`, add:
  ```py
  class LexicalImageResponse(BaseModel):
      image_url: str = Field(..., description="Data URL or HTTP URL for the generated image")
      prompt: str = Field(..., description="Final prompt sent to OpenRouter for debugging/traceability")
  ```

#### 3.1.4 New FastAPI route

- Create `backend/app/api/routes/lexical_map.py`:
  - `router = APIRouter()`
  - Endpoint:
    ```py
    @router.post("/lexical-map/image", response_model=LexicalImageResponse)
    async def generate_lexical_image(payload: LexicalImageRequest) -> LexicalImageResponse:
        ...
    ```
  - Logic:
    1. Normalize and trim `payload.base_word` / `payload.related_word`.
    2. Build prompt using the provided template, substituting the two words.
    3. Call `openrouter_client.generate_image(prompt=prompt)`.
    4. Return `LexicalImageResponse(image_url=image_url, prompt=prompt)`.
  - Error handling:
    - Catch `OpenRouterError`, `APIConnectionError`, `RateLimitError`.
    - Map to `HTTPException` with appropriate status codes and messages:
      - 429 for rate limiting.
      - 503 for upstream/service issues.
      - 500 for unexpected failures.
- Optional optimization (if time allows):
  - Add a small in-memory cache `{(base_word.lower(), related_word.lower()): (timestamp, LexicalImageResponse)}` with TTL (e.g., 1–6 hours) to avoid regenerating images for the same pair during a session.

#### 3.1.5 Wiring into the app

- Update `backend/app/main.py`:
  ```py
  from app.api.routes import analyze, pronunciation, lexical_map

  ...
  app.include_router(analyze.router, prefix="/api", tags=["analyze"])
  app.include_router(pronunciation.router, prefix="/api", tags=["pronunciation"])
  app.include_router(lexical_map.router, prefix="/api", tags=["lexical-map"])
  ```
  - Note: the full endpoint will be `POST /api/lexical-map/image`.

---

### 3.2 Frontend: Lexical Map UI & Image Fetching

#### 3.2.1 Data & types

- No changes needed to global analysis types in `extension/src/shared/types.ts`; the image explanation is purely a **view concern** for the selected word pair.
- Inside `CognitiveScaffolding.tsx`, define a local TypeScript type for the API response:
  ```ts
  interface LexicalImageResponse {
    image_url: string;
    prompt?: string;
  }
  ```

#### 3.2.2 Component state and behavior

- `extension/src/components/CognitiveScaffolding.tsx` currently:
  - Tracks `selectedIndex` for the chosen node.
  - Renders the explanation card only when `selectedIndex !== null`.
- Extend the component:
  - Import `useEffect` from React.
  - Add local state:
    ```ts
    const [viewMode, setViewMode] = useState<'text' | 'image'>('text');
    const [imageState, setImageState] = useState<{
      url: string | null;
      isLoading: boolean;
      error: string | null;
      baseWord: string | null;
      relatedWord: string | null;
    }>({
      url: null,
      isLoading: false,
      error: null,
      baseWord: null,
      relatedWord: null,
    });
    ```
  - When the selected node changes (`selectedIndex` or `word` changes):
    - Reset `viewMode` back to `'text'`.
    - Reset `imageState` (so a new selection starts from a clean state).

#### 3.2.3 Fetching the image

- Inside the `selectedIndex !== null` branch (where the text card is rendered), add a handler:
  ```ts
  const handleGenerateImage = async () => {
    if (selectedIndex === null) return;

    const related = data.relatedWords[selectedIndex];
    if (!related) return;

    const base = baseWord;

    setImageState({
      url: null,
      isLoading: true,
      error: null,
      baseWord: base,
      relatedWord: related.word,
    });
    setViewMode('image');

    try {
      const resp = await fetch(`${API_URL}/api/lexical-map/image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base_word: base,
          related_word: related.word,
        }),
      });

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }

      const json: LexicalImageResponse = await resp.json();

      setImageState((prev) => ({
        ...prev,
        url: json.image_url,
        isLoading: false,
      }));
    } catch (err) {
      console.error('Lexical image generation failed', err);
      setImageState((prev) => ({
        ...prev,
        isLoading: false,
        error: '图片生成失败，请稍后再试。',
      }));
      // Fall back to text view if image fails
      setViewMode('text');
    }
  };
  ```
- Button behavior:
  - Disable the button while `imageState.isLoading` is `true`.
  - If an image has already been generated for the current selection, clicking the button again can:
    - Either re-generate (re-run handler) or
    - Just toggle `viewMode` between `'text'` and `'image'`.
  - For this spec, keep behavior simple:
    - First click: generate and switch to image mode.
    - Subsequent clicks: re-generate and refresh the image (same behavior as first click).

#### 3.2.4 Rendering logic & layout

- Still render the outer `motion.div` card as today, but make its inner content conditional:
  - Inside the existing card markup where `related.keyDifference` / `related.whenToUse` are rendered:
    - Wrap text explanations in `viewMode === 'text' || !imageState.url` guard.
    - In `viewMode === 'image'`:
      - If `imageState.isLoading`: show a small in-card loading state (e.g., skeleton or text `"正在生成图片解释..."`).
      - Else if `imageState.url`: render the `<img>` element.
      - Else (no url and not loading): fall back to text view.
  - Example rendering snippet:
    ```tsx
    {viewMode === 'image' && imageState.url ? (
      <div className="mt-3 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-gray-900/60">
        <img
          src={imageState.url}
          alt={`Visual explanation of the difference between ${baseWord} and ${related.word}`}
          className="w-full h-auto object-contain"
        />
      </div>
    ) : (
      // existing text explanation blocks (关键区别 / 使用场景)
    )}
    ```
- Add the `图片解释` button underneath the content area (but inside the same card):
  - Tailwind styling aligned with existing CTA styles, e.g.:
    ```tsx
    <button
      type="button"
      onClick={handleGenerateImage}
      disabled={imageState.isLoading}
      className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-full bg-primary-50 text-primary-700 hover:bg-primary-100 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-primary-900/30 dark:text-primary-200 dark:hover:bg-primary-900/60"
    >
      {imageState.isLoading ? '正在生成图片解释…' : '图片解释'}
    </button>
    ```
- When no node is selected (`selectedIndex === null`):
  - Do not show the button; keep current instructional text unchanged.

#### 3.2.5 Error UX

- If the image request fails:
  - Show a small error message inside the card near the button (e.g., `图片生成失败，请稍后再试。`).
  - Keep the text explanation visible so the user still gets value from the lexical map.
  - Do not propagate this error into the global `useAppStore.error` (to avoid replacing the whole panel with the generic error state).

---

## 4. Source Code Changes

Planned files to modify/add:

- **Backend**
  - Modify: `backend/app/config.py`
  - Modify: `backend/app/services/openrouter.py`
  - Modify: `backend/app/models/request.py`
  - Modify: `backend/app/models/response.py`
  - Add: `backend/app/api/routes/lexical_map.py`
  - Modify: `backend/app/main.py`
  - (Optional) Add tests under `backend/tests/` for:
    - Image prompt building and request model validation.
    - `OpenRouterClient.generate_image` behavior (with mocked `httpx.AsyncClient`).

- **Frontend (extension)**
  - Modify: `extension/src/components/CognitiveScaffolding.tsx`
  - (Optional) Modify: `extension/src/shared/types.ts` if we later decide to store image metadata in the analysis result; not required for the initial implementation as per this spec.

No new third-party dependencies are required on either side; reuse existing `httpx`, FastAPI, and fetch-based patterns.

---

## 5. Data Model / API / Interface Changes

### Backend

- **Env / config**
  - New setting: `OPENROUTER_IMAGE_MODEL_ID` (optional).
    - Wired into `Settings.openrouter_image_model_id`.
    - Used by `OpenRouterClient` for image generation.

- **New request model**
  ```json
  POST /api/lexical-map/image
  {
    "base_word": "strategy",
    "related_word": "tactic"
  }
  ```

- **New response model**
  ```json
  HTTP 200
  {
    "image_url": "data:image/jpeg;base64,...",
    "prompt": "Draw an XKCD style colored manga depicting and explaining the difference between the word \"strategy\" and \"tactic\" ..."
  }
  ```

### Frontend

- New local interface (inside `CognitiveScaffolding.tsx` only):
  ```ts
  interface LexicalImageResponse {
    image_url: string;
    prompt?: string;
  }
  ```
- No changes to the `AnalysisResult` or `CognitiveScaffolding` types are required; the image is a transient UI-side augmentation.

---

## 6. Verification Approach

### Backend

- **Unit tests**
  - Add tests in `backend/tests`:
    - `LexicalImageRequest` validation (empty/whitespace words rejected or cleaned).
    - `LexicalImageResponse` serialization.
    - `OpenRouterClient.generate_image` parsing of a mocked OpenRouter response containing `choices[0].message.images[0].image_url.url`.
  - Reuse pytest configuration; run:
    ```bash
    cd backend
    poetry run pytest
    ```
- **Manual verification**
  - Start backend with valid `OPENROUTER_API_KEY` and `OPENROUTER_IMAGE_MODEL_ID` in `.env`.
  - Use `curl` or HTTP client to call:
    ```bash
    curl -X POST http://localhost:8000/api/lexical-map/image \
      -H "Content-Type: application/json" \
      -d '{"base_word":"strategy","related_word":"tactic"}'
    ```
  - Confirm that:
    - Response is 200.
    - `image_url` starts with `data:image/` and is non-empty.

### Frontend

- **Manual UX verification**
  1. Build and load the Chrome extension as per the existing README.
  2. Open a page, select a word to trigger analysis.
  3. Wait for Lexical Map (Layer 4) to appear.
  4. Click a node:
     - Text card (关键区别 / 使用场景) appears as before.
  5. Click the new `图片解释` button:
     - Button text switches to loading state, disabled while request is in flight.
     - After a short delay, the image renders in place of the text area.
  6. Verify:
     - The image fits inside the card width and respects dark/light backgrounds.
     - If the request fails, an inline error message appears but the rest of the panel remains functional.
  7. Click another node:
     - Image state resets; text explanation for the new node appears and the button is available again.

- **Non-regression checks**
  - Ensure existing features still work:
    - Behavior pattern streaming (Layer 1).
    - Live contexts (Layer 2).
    - Common mistakes (Layer 3).
    - Personalized tip block within Layer 4.
    - Pronunciation lookup and playback in the header.

This spec should provide enough detail to implement the image explanation feature end-to-end while staying aligned with existing architecture and coding patterns.

