# Technical Specification — Personalization Part A

## Technical Context

- **Frontend**: Chrome extension side panel built with React 18, TypeScript, Vite, TailwindCSS, Zustand, Framer Motion, Lucide icons. Code under `extension/src/**`.
- **Backend**: FastAPI app (`backend/app`) exposing:
  - `/api/analyze` (SSE streaming via `sse_starlette`)
  - `/api/pronunciation/{word}`
  - `/api/lexical-map/image`
  - LLM access via `app/services/openrouter.py` and `LLMOrchestrator` in `llm_orchestrator.py`.
- **Shared state/persistence in extension**: `chrome.storage.local` with keys in `extension/src/shared/constants.ts` (learning history, preferences, user profile).
- **Current personalization**:
  - User profile: nickname + CEFR level (`A1`–`C2`) via `useUserProfile`.
  - Learning history: list of previously looked-up words via `useLearningHistory`.
  - LLM prompt for layer 4 hard‑codes interests: football, buying a house in Beijing, LLM‑related work.

Task complexity: **medium–hard** (new UI surfaces, new local data models, and new LLM‑driven interest logic across frontend + backend).

---

## Requirements Breakdown & Scope

1. **English level overlay in sidepanel profile card**
   - Clicking the English level chip opens a modal/overlay.
   - The overlay lists discrete levels: `Starter / KET / A1 / A2 / B1 / B2 / C1 / C2 / Academic`.
   - Each level shows:
     - Short English‑ability description.
     - Recommended scenario/exam (e.g., “Good for everyday work emails; CET‑4 level”).
   - When a level is selected:
     - The stored profile level is updated and persisted.
     - The English level display in the sidepanel is updated to include the short hint text.

2. **Profile icon + profile management page**
   - Add a profile icon to the right side of the user card, just left of the dark/light mode toggle.
   - Clicking the profile icon switches the sidepanel to a **Profile Management** view.
   - Profile management view includes:
     - Avatar (editable).
     - Nickname (editable).
     - Level (display + ability description; opens level overlay when clicked).
     - **Interest content cards** (initially seeded with 2–3 hardcoded examples like football, Beijing housing, LLM).
     - **Wordbook** section with prebuilt entries and 1–5‑stage mastery progress (initially hardcoded).

3. **Interest cards content**
   - Each interest card shows:
     - Title (e.g., “English football & big matches”).
     - Friendly summary in Chinese similar to “你经常看英超战报和世界杯预选赛”.
     - A list of LexiLens usage links (URL + last used time); for Part A these can be placeholder data but the structure must support real entries.

4. **LLM‑summarized interests from latest LexiLens usage**
   - From the **latest page(s)** where the user used LexiLens, use the LLM to:
     - Propose an interest topic title and summary.
     - Decide whether this should:
       - Create a new interest card, or
       - Be merged into an existing interest card, updating its summary.
   - This must be wired so that the extension can call an API and then update local interest state accordingly, even if the first implementation uses mocked/stubbed responses.

5. **Managing interests & deletion behavior**
   - On the profile page:
     - Individual **links** within an interest card can be removed.
     - Entire **interest cards** can be deleted.
   - After deletion:
     - Future explanations (layer 4 personalized coaching and UI copy) must not reference that interest topic.
     - The “explanation” flows must gracefully handle the case where **no interests** exist (no awkward references to missing topics).

Out of scope for Part A:
- Syncing profile/interest data across devices (everything stays in `chrome.storage.local`).
- Full clustering of long‑term history into many topics; we only need last‑usage–driven updates.

---

## Implementation Approach

### 1. Frontend: English Level Modal & Profile Card Updates

1.1 **Normalize English level model**

- Replace the current narrow `EnglishLevel` union (`'A1' | ... | 'C2'`) with an expanded union:
  ```ts
  export type EnglishLevel =
    | 'Starter'
    | 'KET'
    | 'A1'
    | 'A2'
    | 'B1'
    | 'B2'
    | 'C1'
    | 'C2'
    | 'Academic';
  ```
- Add a config map for all levels (shared between components):
  ```ts
  interface EnglishLevelConfig {
    id: EnglishLevel;
    label: string;           // e.g. 'B2'
    ability: string;         // short ability description
    recommendation: string;  // exam or scene recommendation
    cefrHint: string;        // text for LLM prompt (e.g. 'A2 (KET)')
  }
  export const ENGLISH_LEVELS: Record<EnglishLevel, EnglishLevelConfig> = { ... };
  ```
- Add helpers:
  - `getLevelConfig(level: EnglishLevel): EnglishLevelConfig`
  - `getCefrForPrompt(level: EnglishLevel): string` — maps new labels (`Starter`, `Academic`, `KET`) to a CEFR‑style string (`"below A1 (Starter)"`, `"A2 (KET)"`, `"C1–C2 Academic"`).

1.2 **Update `useUserProfile`**

- Keep the stored `englishLevel` as `EnglishLevel` (string union above).
- Extend `isEnglishLevel` to accept both legacy CEFR values and the new labels, so existing stored profiles keep working.
- Expose `updateProfile` unchanged so that callers can update `englishLevel`, `nickname`, `avatarUrl`.

1.3 **Level overlay UI**

- Create a reusable modal component, e.g. `extension/src/components/EnglishLevelDialog.tsx`:
  - Props: `isOpen`, `currentLevel`, `onSelect(level: EnglishLevel)`, `onClose`.
  - Full‑screen semi‑transparent overlay (`fixed inset-0 bg-black/40`) with a centered card that lists `ENGLISH_LEVELS` options.
  - Each option rendered as a clickable card with:
    - Level label (e.g. “B2 · 上手读专业文章”).
    - Ability description (English/Chinese combo, concise).
    - Recommendation line (“适合：工作邮件 / 学术论文 / IELTS 7+”).
- Wire the level chip in `UserProfileCard` to open this dialog:
  - Add an optional `onLevelClick` prop to `UserProfileCard`.
  - Wrap the level pill in a `button` with appropriate ARIA labels.

1.4 **Display selected level with hints**

- In `UserProfileCard` and `CoachSummary`, replace the hardcoded `levelLabels` map with derived text from `ENGLISH_LEVELS`:
  - Badge: `config.label` (e.g. `B2`) plus a short Chinese tag.
  - For `CoachSummary`, show `"{label} · {ability}"`.
- When the user selects a level in the dialog:
  - Call `updateProfile({ englishLevel: nextLevel })`.
  - The UI reflects the new level and hint immediately.

### 2. Frontend: Profile Management Page

2.1 **Navigation between main view and profile view**

- In `sidepanel/App.tsx`, introduce a simple view state:
  ```ts
  type SidepanelView = 'coach' | 'profile';
  const [view, setView] = useState<SidepanelView>('coach');
  ```
- Pass `onOpenProfile={() => setView('profile')}` into `UserProfileCard`.
- Render:
  - `view === 'coach'`: current analyzer UI (unchanged).
  - `view === 'profile'`: new `ProfilePage` component with a back button (`setView('coach')`).

2.2 **ProfilePage layout**

- New component `extension/src/sidepanel/ProfilePage.tsx` that:
  - Receives `profile`, `onUpdateProfile`, `interests`, `wordbook`, and relevant mutators via props or hooks.
  - Sections:
    1. **Header**:
       - Title: “个人信息 & 兴趣”.
       - Back button to return to the coach view.
    2. **Basic info**:
       - Avatar: circular image (same visual style as `UserProfileCard`).
         - For Part A, allow:
           - Upload via `input[type=file]` and store as a data URL, or
           - Enter an avatar image URL; stored as `avatarUrl`.
       - Nickname: `input` bound to `profile.nickname`, with debounced `updateProfile`.
       - Level: read‑only pill showing current level; clicking it opens the level dialog.
    3. **Interests section**:
       - Grid or stacked list of `InterestCard` components (see §3).
       - Empty state message when there are no interests.
    4. **Wordbook section**:
       - List of word entries with a small multi‑segment progress bar (stages 1–5).
       - For Part A, prepopulate with a few demo words.

2.3 **Wordbook UI & state**

- New interfaces in `extension/src/shared/types.ts`:
  ```ts
  export interface WordbookEntry {
    id: string;
    word: string;
    translation?: string;
    example?: string;
    stage: 1 | 2 | 3 | 4 | 5;  // mastery level
    lastReviewedAt?: number;
  }
  ```
- New hook `extension/src/sidepanel/hooks/useWordbook.ts`:
  - Backed by `chrome.storage.local` with new key `STORAGE_KEYS.WORDBOOK`.
  - For Part A:
    - Initialize with a static list (e.g., 5–8 words relevant to the existing demo topics).
    - Expose read operations and an API to update stage (even if not yet wired into the main analyzer).
- UI implementation:
  - `WordbookSection` component inside `ProfilePage` renders entries with:
    - Word + optional translation.
    - Compact stage visualization (e.g., 5 small segments, filled up to `stage`).

### 3. Frontend: Interest Topics & LexiLens Usage

3.1 **Interest data model**

- Extend `extension/src/shared/types.ts`:
  ```ts
  export interface InterestLink {
    url: string;
    title?: string;
    lastUsedAt: number;
  }

  export interface InterestTopic {
    id: string;             // stable id (e.g. slug)
    title: string;          // e.g. '英超和世界杯足球'
    summary: string;        // Chinese description of behavior
    links: InterestLink[];  // LexiLens sessions belonging to this interest
    createdAt: number;
    updatedAt: number;
  }
  ```

3.2 **Storage keys & demo data**

- In `extension/src/shared/constants.ts`:
  - Add:
    ```ts
    export const STORAGE_KEYS = {
      ...,
      INTERESTS: 'lexilens_interests',
      INTERESTS_BLOCKLIST: 'lexilens_interests_blocklist',
      WORDBOOK: 'lexilens_wordbook',
    } as const;
    ```
  - Add demo initial data lists:
    - `DEMO_INTERESTS: InterestTopic[]` with 2–3 hardcoded topics:
      - Football matches.
      - Beijing housing market.
      - LLM / AI‑related work.
    - `DEMO_WORDBOOK: WordbookEntry[]`.
  - Demo `links` can use placeholder URLs (`https://example.com/premier-league-report`) and timestamps (`Date.now() - ...`).

3.3 **useInterests hook**

- New hook `extension/src/sidepanel/hooks/useInterests.ts`:
  - State:
    - `topics: InterestTopic[]`
    - `blockedTitles: string[]` (from `INTERESTS_BLOCKLIST`)
    - `loading: boolean`
  - Behavior:
    - On mount, load `INTERESTS` from `chrome.storage.local`.
      - If empty, seed with `DEMO_INTERESTS` and persist.
    - API:
      ```ts
      addOrUpdateFromServer(updatedTopics: InterestTopic[]): void;
      addLinkToTopic(topicId: string, link: InterestLink): void;
      removeLink(topicId: string, url: string): void;
      deleteTopic(topicId: string): void; // also updates blocklist
      ```
    - `deleteTopic`:
      - Removes the topic from `topics`.
      - Adds its `title` (or `id`) to `blockedTitles` and persists to `INTERESTS_BLOCKLIST`.

3.4 **Interest cards UI**

- New component `extension/src/components/InterestCard.tsx`:
  - Props: `topic`, `onRemoveLink(url)`, `onDeleteTopic()`.
  - Layout:
    - Title + subtle badge (e.g. “兴趣领域”).
    - Summary line in Chinese; single paragraph.
    - List of recent links:
      - Show host (e.g. `bbc.com`) and time (“2 天前”, based on `lastUsedAt`).
      - Clickable to open in a new tab (`chrome.tabs.create`), respecting extension permissions.
    - Small “删除链接” action per link.
    - “删除这个兴趣” button/icon for the whole card, with confirmation.
  - Integrated into `ProfilePage` under an “兴趣内容” heading.

3.5 **Capturing LexiLens usage for interests**

- In `sidepanel/App.tsx` `handleSelection`:
  - For each new selection that triggers an analysis, construct a `LexiLensUsage` object (local only):
    ```ts
    interface LexiLensUsage {
      word: string;
      context: string;
      pageType?: AnalysisRequest['pageType'];
      url?: string;
      timestamp: number;
    }
    ```
  - For Part A, the usage object does **not** need its own storage key; instead:
    - Pass the latest usage and current `topics` into the interest‑summarization API (see §4).
    - When the API responds, apply updates to `topics` via `useInterests`.

### 4. Backend: LLM‑Driven Interest Summarization

4.1 **New API endpoint**

- Add a new route module `backend/app/api/routes/interests.py`:
  - Endpoint: `POST /api/interests/from-usage`
  - Request model `InterestFromUsageRequest`:
    ```py
    class InterestTopicPayload(BaseModel):
        id: str | None
        title: str
        summary: str
        urls: list[str] = []

    class InterestFromUsageRequest(BaseModel):
        word: str
        context: str
        page_type: str | None = None
        url: str | None = None
        existing_topics: list[InterestTopicPayload] = []
        blocked_titles: list[str] = []
    ```
  - Response model `InterestFromUsageResponse`:
    ```py
    class InterestFromUsageResponse(BaseModel):
        topics: list[InterestTopicPayload]
    ```
  - Semantics:
    - Given one **latest usage** (word + context + url + page_type) and existing topics:
      - Decide whether to create a new topic or update an existing one.
      - Return the **updated full topics list** (server is stateless; the extension remains the source of truth).

4.2 **LLM orchestration for interests**

- Add a method to `LLMOrchestrator`:
  ```py
  async def summarize_interests_from_usage(
      self,
      word: str,
      context: str,
      page_type: str | None,
      url: str | None,
      existing_topics: list[InterestTopicPayload],
      blocked_titles: list[str],
  ) -> list[InterestTopicPayload]:
      ...
  ```
- Prompt responsibilities:
  - Input:
    - Short description of the latest page (word + context + optional page_type + url).
    - A list of current topics (`title` + `summary` + example URLs).
    - A list of `blocked_titles` that must **not** be reused.
  - Output:
    - JSON list of topics the extension should store afterwards:
      - If the new usage is **similar** to an existing topic: update its summary to mention the new behavior and append the URL.
      - If it’s distinct and not blocked: create a new topic.
      - Never reintroduce topics whose titles are in `blocked_titles`.
- The FastAPI route:
  - Validates the payload.
  - Calls `summarize_interests_from_usage`.
  - Returns `InterestFromUsageResponse(topics=result)`.

4.3 **Extension integration**

- In `useStreamingAnalysis` or in `App.tsx` after a successful `/api/analyze` call:
  - Fire‑and‑forget `fetch` to `/api/interests/from-usage` with:
    - `word`, `context`, `page_type`, `url` from the latest `AnalysisRequest`.
    - `existing_topics` derived from `useInterests.topics` (only `id`, `title`, `summary`, and URLs).
    - `blocked_titles` from `useInterests`.
  - On success:
    - Map payload back to `InterestTopic` shape (fill in `createdAt` / `updatedAt` as needed).
    - Call `addOrUpdateFromServer` to persist.
  - This call should be non‑blocking for the main analysis UI; errors should be logged but not surfaced as user‑visible errors in Part A.

### 5. Backend & Prompt Builder: Using Interests in Explanations

5.1 **Augment AnalyzeRequest with interest info (for future use)**

- Extend `backend/app/models/request.py`:
  - Add optional fields:
    ```py
    class AnalyzeRequest(BaseModel):
        ...
        url: Optional[str] = Field(
            None,
            description="Full URL of the page where LexiLens was triggered",
        )
        interests: Optional[list[InterestTopicPayload]] = Field(
            default_factory=list,
            description="Current interest topics used to personalize explanations",
        )
        blocked_titles: Optional[list[str]] = Field(
            default_factory=list,
            description="Interest titles that should NOT be mentioned",
        )
    ```
  - For Part A, `interests` / `blocked_titles` can be left unused in `/api/analyze` if desired; they are primarily needed in `build_layer4_prompt` (see below).

5.2 **Update `PromptBuilder.build_layer4_prompt`**

- Add optional `interests` and `blocked_titles` parameters:
  ```py
  def build_layer4_prompt(
      word: str,
      context: str,
      learning_history: list[str] | None = None,
      english_level: str | None = None,
      interests: list[InterestTopicPayload] | None = None,
      blocked_titles: list[str] | None = None,
  ) -> tuple[str, str]:
      ...
  ```
- Prompt logic:
  - When **interests exist**:
    - Include a short list of topics in the prompt:
      - e.g. “The learner especially likes these topics: 1) English football and Premier League reports, 2) Beijing housing market, 3) AI / large language models.”
    - Ask the model, when generating `"personalized"`, to choose 1–2 of these topics for analogies.
  - When **blocked_titles** are non‑empty:
    - Add a constraint like:
      - “Do NOT mention these topics in your answer: ...”
  - When **no interests exist**:
    - Remove the old hardcoded interests (“足球比赛、在北京买房、大模型相关的工作”).
    - Instead, instruct the model to use generic everyday life scenes and not mention specific niche topics unless obviously suggested by the context.
- Update tests in `backend/tests/test_prompt_builder.py` to:
  - Verify that layer 4 prompt:
    - No longer hard‑codes the three demo interests.
    - Includes `"personalized"` and Chinese instructions as before.
    - Includes interest descriptions when provided.

5.3 **Frontend prompt caller**

- In `useStreamingAnalysis`, when building the body for `/api/analyze`:
  - Optionally include `interests` and `blocked_titles` (even if Part A doesn’t fully exploit them yet), derived from `useInterests`.
  - Ensure the existing behavior is preserved when these fields are absent.

### 6. Deletion Behavior & Empty States

- Deleting an interest card:
  - Removes it from `topics`.
  - Adds its title to `blocked_titles` storage.
  - Updates local state so future `/api/interests/from-usage` and `/api/analyze` calls include the blocklist.
- Deleting all interests:
  - Profile page:
    - Shows a friendly empty state: “还没有个性化兴趣，可以多用几次 LexiLens，我会帮你总结。”.
  - Prompt builder:
    - Works with generic life scenes; no references to removed demo topics.
  - `CoachSummary` copy:
    - When `topics.length === 0`, replace the sentence that mentions user interests with a more generic phrasing (“结合你日常会遇到的场景…”).

---

## Source Code Structure Changes

Planned new/modified files:

- **New frontend files**
  - `extension/src/components/EnglishLevelDialog.tsx`
  - `extension/src/components/InterestCard.tsx`
  - `extension/src/sidepanel/ProfilePage.tsx`
  - `extension/src/sidepanel/hooks/useInterests.ts`
  - `extension/src/sidepanel/hooks/useWordbook.ts`
- **Modified frontend files**
  - `extension/src/sidepanel/App.tsx` — view switching, interest API calls, pass profile callbacks.
  - `extension/src/components/UserProfileCard.tsx` — clickable level, profile icon.
  - `extension/src/components/CoachSummary.tsx` — dynamic interests wording & level display.
  - `extension/src/shared/constants.ts` — new storage keys, demo data.
  - `extension/src/shared/types.ts` — new interfaces (`InterestTopic`, `InterestLink`, `WordbookEntry`) and updated `AnalysisRequest` if interests are included.
  - `extension/src/sidepanel/hooks/useUserProfile.ts` — expanded levels, level config.
  - `extension/src/sidepanel/hooks/useStreamingAnalysis.ts` — optionally send interest metadata, trigger interest summarization call.
- **New backend files**
  - `backend/app/api/routes/interests.py` — `POST /api/interests/from-usage`.
  - `backend/app/models/interests.py` (optional helper module) — `InterestTopicPayload`, `InterestFromUsageRequest`, `InterestFromUsageResponse`.
- **Modified backend files**
  - `backend/app/models/request.py` — add `url`, `interests`, `blocked_titles` to `AnalyzeRequest`.
  - `backend/app/services/prompt_builder.py` — update `build_layer4_prompt`.
  - `backend/app/services/llm_orchestrator.py` — add `summarize_interests_from_usage`.
  - `backend/app/api/routes/__init__.py` / main router wiring to include the new `interests` route.
  - `backend/tests/test_prompt_builder.py` — adjust expectations to match new prompt text.

---

## Data Model / API / Interface Summary

- **User profile (extension)**
  - `UserProfile`:
    - `nickname: string`
    - `englishLevel: EnglishLevel` (`Starter | KET | A1 | ... | Academic`)
    - `avatarUrl?: string`
- **Interest topics (extension + backend)**
  - `InterestTopic` / `InterestTopicPayload`:
    - `id: string | None` (server can work with `None`, extension uses string)
    - `title: string`
    - `summary: string`
    - `links: InterestLink[]` (extension only)
    - `urls: list[str]` (backend minimal representation)
  - Blocklist:
    - `blocked_titles: string[]` stored client‑side and sent to backend.
- **Wordbook**
  - `WordbookEntry` with `stage: 1..5`.
- **APIs**
  - `POST /api/interests/from-usage`:
    - Request: latest usage + existing topics + blocklist.
    - Response: updated topics list.
  - `POST /api/analyze`:
    - Request extended to optionally include `url`, `interests`, `blocked_titles`.
    - Response SSE stream unchanged (layers 1–4 + `done`).

---

## Verification Approach

- **Frontend**
  - Run lint and typecheck:
    - `cd extension && pnpm lint`
    - `cd extension && pnpm typecheck`
  - Build extension to ensure Vite/CRX config and manifest still work:
    - `cd extension && pnpm build`
  - Manual checks in Chrome:
    - Open sidepanel:
      - Verify English level chip opens the modal and persists selection.
      - Toggle profile icon to open Profile page and back.
      - Confirm avatar/nickname edits persist across reloads.
      - Inspect Interest cards: demo data appears, link deletion works, full card deletion updates empty state.
    - After using LexiLens on a few pages:
      - Confirm that calling the interests API updates cards (even if initially mocked).
      - Confirm explanations stop mentioning removed interests.
- **Backend**
  - Unit tests:
    - `cd backend && poetry run pytest`
      - Update `test_prompt_builder.py` to cover new layer 4 prompt behavior (interests and no hard‑coded themes).
  - Local API smoke tests (e.g., via HTTP client or curl):
    - `POST /api/interests/from-usage` with synthetic payloads:
      - Case: no existing topics → new topic created.
      - Case: similar existing topic → summary updated (per LLM output) instead of new one.
      - Case: topic in blocklist → no new topic created with that title.
    - `POST /api/analyze` still returns valid SSE events and works with/without the new optional fields.

