# Word List Management – Technical Specification

## 1. Scope & Requirements

Feature area: **LexiLens Chrome extension wordbook & profile page** (frontend) with optional prompt tweaks in the **FastAPI backend**.

User requirements (translated/condensed):

1. Every time the user requests a new explanation, add a record to the **wordbook** and persist all generated content for that explanation (including Lexical Map images).
2. When the user clicks the **favorite/收藏** button in the header, treat that explanation as a **favorite word**. When all else is equal, favorite words should have higher priority in explanations and Lexical Map usage.
3. On the **Profile** page, the user can manage their wordbook:
   - Click a wordbook entry to open that entry’s content, using almost the same layout as the normal coach sidepanel.
   - In that view, add a small entry at the top that can open the original page link for that entry. After opening, the corresponding entry is selected/highlighted in the word list.
   - Support toggling favorite /非收藏 and deleting entries (with a confirmation step).
4. Each time a word appears in an explanation or appears once in the Lexical Map, its **mastery level** should increase by one block (up to a maximum).
5. On the Profile page, the wordbook list should:
   - Sort favorites first.
   - Within each group, sort by **reverse addition order** (most recently added first).
   - Paginate the list.
   - Visually mark favorite entries.

**Difficulty:** medium–hard. Changes cut across:
- Data model and persistence (wordbook schema and storage).
- Core analysis flow (where to hook “on explanation complete”).
- Lexical Map image flow.
- Sidepanel views, header actions, and Profile/wordbook UI.
- Optional backend prompt changes for favorites.

Assumptions (callouts where the spec makes a choice):
- Wordbook entries are **per headword** (one entry per word), but can carry multiple explanation snapshots over time.
- “Add a record each time” means “append a new explanation snapshot under that word’s entry”, not creating multiple separate cards for the same word.
- Mastery level is the existing `stage` property (1–5). We only **increment up to 5**; no automatic decreases.
- For “highlight on open link”, this spec keeps the highlight inside the **profile wordbook list / saved-entry view**, not on the original web page content. A future iteration could add content-script integration to re-select the sentence on-page.

## 2. Technical Context

### 2.1 Frontend (extension)

- Stack: React 18, TypeScript, Vite, MV3 Chrome extension (`extension/`).
- State:
  - `useAppStore` (Zustand) holds `currentWord`, `currentContext`, `analysisResult`, `isLoading`, `error` (`extension/src/store/appStore.ts`).
  - `useStreamingAnalysis` streams SSE from backend and updates `useAppStore` (`extension/src/sidepanel/hooks/useStreamingAnalysis.ts`).
  - `useLearningHistory` manages per-user lookup history in `chrome.storage.local` (`extension/src/sidepanel/hooks/useLearningHistory.ts`).
  - `useInterests` manages interest topics, partially backed by backend (`extension/src/sidepanel/hooks/useInterests.ts`).
  - `useWordbook` currently:
    - Reads/writes `STORAGE_KEYS.WORDBOOK` in `chrome.storage.local`.
    - Seeds from `DEMO_WORDBOOK`.
    - Supports only `entries`, `loading`, `updateStage` (`extension/src/sidepanel/hooks/useWordbook.ts`).
  - Profile UI uses `useWordbook` to show a simple list with stage adjustment sliders (`extension/src/sidepanel/ProfilePage.tsx`).
  - Header shows word, definition, pronunciation, and a **placeholder** “Add to wordlist” button (`extension/src/components/Header.tsx`).
  - Lexical Map is implemented in `CognitiveScaffolding.tsx`, which:
    - Displays related words graphically.
    - Calls `POST /api/lexical-map/image` to fetch an image; response type `LexicalImageResponse { image_url, prompt? }`.

### 2.2 Backend

- FastAPI app in `backend/app`.
- `POST /api/analyze` streams multi-layer analysis via SSE (`backend/app/api/routes/analyze.py`, `backend/app/services/llm_orchestrator.py`).
- Request model `AnalyzeRequest` (`backend/app/models/request.py`) currently includes:
  - `word`, `context`, `page_type`, `english_level`, `url`, `learning_history`, `interests`, `blocked_titles`.
- Prompts configured via `PROMPT_CONFIG` (`backend/app/prompt_config.py`).
- Cognitive scaffolding / Lexical Map prompt is defined under key `"layer4"`.
- `POST /api/lexical-map/image` generates Lexical Map images and returns `LexicalImageResponse { image_url, prompt }` (`backend/app/api/routes/lexical_map.py`).

## 3. Data Model & Storage Design

### 3.1 Extended WordbookEntry schema

Current type (`extension/src/shared/types.ts`):

```ts
export interface WordbookEntry {
  id: string;
  word: string;
  translation?: string;
  example?: string;
  stage: 1 | 2 | 3 | 4 | 5;
  lastReviewedAt?: number;
}
```

New schema (backwards compatible; all new fields optional):

```ts
export interface WordbookSnapshot {
  id: string;               // unique per snapshot (e.g. timestamp-based)
  createdAt: number;        // ms since epoch
  request: {
    context: string;
    pageType?: AnalysisRequest['pageType'];
    url?: string;
  };
  analysis: AnalysisResult; // full snapshot of layers + pronunciation at that time
  lexicalImages?: {
    baseWord: string;       // lexical base word used for the map
    relatedWord: string;
    imageUrl: string;
    prompt?: string;
    createdAt: number;
  }[];
}

export interface WordbookEntry {
  id: string;                     // stable per headword, usually normalized word
  word: string;
  translation?: string;           // demo-only / optional for new entries
  example?: string;               // optional: best example sentence to show in list
  stage: 1 | 2 | 3 | 4 | 5;       // mastery level
  lastReviewedAt?: number;

  isFavorite?: boolean;           // “精选” flag
  createdAt?: number;             // when this word was first added
  updatedAt?: number;             // last time we updated any part of this entry

  // Most recent explanation snapshot (the one shown when user clicks the card).
  latestSnapshot?: WordbookSnapshot;

  // Optional bounded history of older snapshots for future expansion (not surfaced in UI now).
  snapshots?: WordbookSnapshot[];
}
```

Key points:
- Existing stored entries (demo or early user data) deserialize cleanly:
  - Missing fields default via `sanitizeEntries`.
  - `stage` is kept; new fields start undefined.
- `id` remains string; for new entries, we normalize as `word.toLowerCase()` plus optional suffix if needed to avoid collisions.
- Only **one entry per headword**. Multiple explanations are stored as snapshots under that entry:
  - `latestSnapshot` is always the newest.
  - `snapshots` keeps older ones up to a small bound (e.g. `MAX_SNAPSHOTS_PER_WORD = 5`).

### 3.2 Storage & quotas

- All wordbook data continues to live in `chrome.storage.local` under `STORAGE_KEYS.WORDBOOK`.
- To avoid unbounded growth:
  - Limit total number of entries (e.g. `MAX_WORDBOOK_ENTRIES = 500`).
  - When exceeding the limit, drop the oldest non-favorite entries first.
  - Limit `snapshots.length` per word (e.g. <= 5); when adding a new snapshot, push to front and trim.

### 3.3 Mastery / stage semantics

- `stage` continues to represent **overall mastery** across all exposures for that word.
- Auto updates:
  - Stage increments by **1** for each qualifying exposure (see §5).
  - Stage is clamped to `[1, 5]`.
  - Manual changes via the Profile slider still work and always win (i.e. we directly set `stage` to user’s chosen value).
- Optionally track an internal `exposureCount` in `latestSnapshot` or entry-level metadata if needed for future logic; **not required** for current UI.

## 4. Wordbook Hook API

We extend `useWordbook` (`extension/src/sidepanel/hooks/useWordbook.ts`) to be the single source of truth for:
- Loading, sanitizing, and persisting entries.
- Creating/updating entries from analysis results.
- Toggling favorites.
- Mastery stage updates.
- Deletion.
- Recording Lexical Map images.

### 4.1 New hook result shape

```ts
interface UseWordbookResult {
  entries: WordbookEntry[];
  loading: boolean;

  // Stage & exposure
  updateStage: (id: string, stage: WordbookEntry['stage']) => void;
  incrementStageForWord: (word: string, reason: 'analysis' | 'lexical-map') => void;

  // Persistence of explanations
  upsertEntryFromAnalysis: (params: {
    request: AnalysisRequest;
    analysis: AnalysisResult;
  }) => void;

  // Lexical Map images
  recordLexicalImage: (params: {
    word: string;           // headword under which we store this image
    baseWord: string;       // lexical base word used in map
    relatedWord: string;
    imageUrl: string;
    prompt?: string;
  }) => void;

  // Favorites & deletion
  toggleFavoriteByWord: (word: string) => void;
  deleteEntry: (id: string) => void;
}
```

Implementation details:
- `sanitizeEntries`:
  - Accepts both old and new shapes.
  - Fills default `stage = 1` if missing or invalid.
  - Ensures `createdAt`/`updatedAt` are numbers where present; otherwise set `createdAt` to timestamp from `lastReviewedAt` or `Date.now()`; `updatedAt` mirrors `createdAt` on first load.
- `upsertEntryFromAnalysis`:
  - Normalize headword key: `normalizedWord = request.word.trim()`.
  - Find existing entry by `entry.word.toLowerCase() === normalizedWord.toLowerCase()`.
  - Build a new `WordbookSnapshot` with:
    - `request.context`, `request.pageType`, `request.url`.
    - The full `AnalysisResult` currently in `useAppStore` for that word.
  - If entry exists:
    - Replace `latestSnapshot`.
    - Prepend to `snapshots` array (dedup by `snapshot.id`).
    - Update `updatedAt = now`.
  - If no entry:
    - Create a new entry with:
      - `id` defaulting to lowercased word (ensuring uniqueness).
      - `word`, `stage = 1`, `createdAt = updatedAt = now`.
      - `latestSnapshot` = snapshot, `snapshots = [snapshot]`.
  - Persist updated entries to storage.
- `incrementStageForWord`:
  - Look up entry by headword (case-insensitive).
  - If not found, **do nothing** (we don’t auto-create entries purely from incidental exposures; only explicit analyses create entries).
  - If found, increment `stage` by 1 up to 5, update `lastReviewedAt` and `updatedAt`, persist.
- `recordLexicalImage`:
  - Target entry is the one for the given `word` (headword).
  - Append `{ baseWord, relatedWord, imageUrl, prompt, createdAt: now }` to:
    - `latestSnapshot.lexicalImages`, and
    - optionally to a flattened `entryImages` helper on the entry if later needed for UI.
  - Persist entry.
- `toggleFavoriteByWord`:
  - Flip `isFavorite` on the entry for that headword.
  - If no entry exists yet, this call first creates a basic entry with `stage = 1` and no snapshot, then marks as favorite.
- `deleteEntry`:
  - Remove matching entry by `id`.
  - Persist updated array.

## 5. Analysis & Exposure Flow

### 5.1 When to create/update wordbook entries

Entry creation & snapshot persistence should happen after an analysis completes for a word:

- Trigger point:
  - After SSE streaming finishes successfully for a new analysis request.
  - The final `AnalysisResult` is available in `useAppStore`.
- Implementation approach:
  - Add a lightweight hook `useAnalysisPersistence` in `extension/src/sidepanel/hooks` that:
    - Uses `useWordbook`.
    - Exposes a function `onAnalysisComplete(request: AnalysisRequest)` which:
      - Reads the latest `analysisResult` for the current word via `useAppStore.getState()`.
      - Calls `upsertEntryFromAnalysis({ request, analysis })`.
      - Calls `incrementStageForWord(request.word, 'analysis')`.
  - Update `useStreamingAnalysis` to accept an optional callback:

    ```ts
    export function useStreamingAnalysis(
      options?: { onAnalysisComplete?: (request: AnalysisRequest) => void },
    ) { /* ... */ }
    ```

    - After finishing the streaming loop and clearing loading state, if `options.onAnalysisComplete` is provided and the stream was not aborted, call it with the original `request`.
  - In `App.tsx`, wire:

    ```ts
    const wordbook = useWordbook();
    const { onAnalysisComplete } = useAnalysisPersistence(wordbook);
    const { startAnalysis } = useStreamingAnalysis({ onAnalysisComplete });
    ```

### 5.2 Mastery increments (requirement 4)

Sources of exposure:

1. **Explanation for the headword**
   - Each time an analysis completes for `word`, call:
     - `incrementStageForWord(word, 'analysis')`.
   - This aligns with “each time the explanation for this word is requested”.

2. **Lexical Map usage for that word**
   - When `CognitiveScaffolding` mounts for a given `word`:
     - Fire a one-time `onLexicalMapShown(word)` callback (from props), implemented via `incrementStageForWord(word, 'lexical-map')`.
   - Stage increments only once per Lexical Map view per word, regardless of how many related nodes are clicked.

For this iteration, we **do not** attempt to scan other words’ explanations to detect incidental occurrences of a saved word; the complexity vs. value trade-off is poor. Instead:
- A word’s stage reflects:
  - How many times it has been explicitly analyzed.
  - How often its Lexical Map has been used from within its own entry.

If needed, we can later expand `incrementStageForWord` to also trigger when a related word’s node or image is generated and that related word exists as a wordbook entry.

## 6. Favorites & Priority (requirement 2)

### 6.1 Favorite state & header UX

Header component (`extension/src/components/Header.tsx`) currently receives:
- `word`, `pronunciation`, `definition`, `onAddToWordlistClick`.

We will:
- Extend props:

```ts
interface HeaderProps {
  word: string;
  pronunciation?: { ipa: string; audioUrl?: string };
  definition?: string;
  onAddToWordlistClick?: () => void; // repurposed as toggle favorite
  isFavorite?: boolean;
}
```

- Update the UI:
  - Use a filled vs. outline bookmark icon to indicate favorite state.
  - Update tooltip text to reflect current state:
    - Non-favorite: “加入生词表（标为精选）”.
    - Favorite: “移除精选”.
- In `App.tsx`:
  - Use `useWordbook` to compute:

    ```ts
    const wordbook = useWordbook();
    const activeWord =
      analysisResult?.word || currentWord || '';
    const isFavorite = wordbook.entries.some(
      (e) => e.word.toLowerCase() === activeWord.toLowerCase() && e.isFavorite,
    );
    ```

  - Pass `isFavorite` and `onAddToWordlistClick={() => wordbook.toggleFavoriteByWord(activeWord)}` to `Header`.
  - Ensure that toggling favorite also sets/creates the corresponding wordbook entry if it doesn’t exist yet.

### 6.2 Priority in explanation & Lexical Map

Two places to reflect “higher priority for favorites” without overhauling architecture:

1. **Personalized coaching (Layer 4 prompt)**
   - Extend `AnalysisRequest` in `extension/src/shared/types.ts`:

     ```ts
     export interface AnalysisRequest {
       // existing fields...
       favoriteWords?: string[];
     }
     ```

   - In `App.tsx` `handleSelection`:
     - Compute `favoriteWords` from `useWordbook().entries`.
     - Attach `favoriteWords` to `request`.
   - Backend changes:
     - `backend/app/models/request.py`:

       ```py
       class AnalyzeRequest(BaseModel):
           # existing fields...
           favorite_words: Optional[List[str]] = Field(
               default_factory=list,
               description="Subset of learning words explicitly marked as favorites."
           )
       ```

     - `backend/app/services/prompt_builder.py`:
       - Update `build_layer4_prompt` signature to accept `favorite_words: list[str] | None = None`.
       - Update `history_note` (or new `favorites_note_template`) in `PROMPT_CONFIG["layer4"]` to incorporate favorites, e.g.:

         > The learner has marked these words as especially important: {favorites_preview}. When it helps, connect the new word to 1–2 of these favorites in the personalized coaching.

       - Pass `request.favorite_words` into `build_layer4_prompt`.
   - Behavior:
     - LLM is nudged to reference favorites more frequently in the `personalized` coaching field and in choice of related words.

2. **Lexical Map default node for images**
   - `CognitiveScaffolding.tsx` already picks a preferred related word via `selectPreferredRelatedIndex`.
   - Extend props:

     ```ts
     interface CognitiveScaffoldingProps {
       data: CognitiveScaffoldingType;
       word: string;
       enableAsyncImageWarmup?: boolean;
       favoriteWords?: string[];
     }
     ```

   - Update `selectPreferredRelatedIndex` to:
     - First filter related words whose `.word` matches any in `favoriteWords` (case-insensitive).
     - Among those, pick the smallest word alphabetically.
     - Fallback to current synonym-then-alphabetical logic when no favorites match.
   - In `App.tsx`, pass `favoriteWords` from `useWordbook` when rendering `CognitiveScaffolding`.

This keeps the “priority” semantics localized:
- Favorites influence **personalized coaching** choices and **default Lexical Map node selection**, without changing fundamental API or control flow.

## 7. Profile Wordbook Management (requirement 3 & 5)

### 7.1 Sorting & pagination

In `ProfilePage.tsx`:

- Introduce derived `sortedEntries`:

```ts
const sortedEntries = [...wordbook.entries].sort((a, b) => {
  const favA = !!a.isFavorite;
  const favB = !!b.isFavorite;
  if (favA !== favB) return favA ? -1 : 1; // favorites first

  const aCreated = a.createdAt ?? a.lastReviewedAt ?? 0;
  const bCreated = b.createdAt ?? b.lastReviewedAt ?? 0;
  return bCreated - aCreated; // newest first
});
```

- Pagination state:

```ts
const PAGE_SIZE = 10; // configurable
const [page, setPage] = useState(0);
const totalPages = Math.max(1, Math.ceil(sortedEntries.length / PAGE_SIZE));
const pageEntries = sortedEntries.slice(
  page * PAGE_SIZE,
  (page + 1) * PAGE_SIZE,
);
```

- Add simple controls (“上一页/下一页”, page indicator) below the list; disable buttons at bounds.
- Reset `page` to 0 when `wordbook.entries.length` shrinks or when favorites are toggled if needed for UX.

### 7.2 Card UI, favorite toggle & delete

- Replace inline list items with a small card that includes:
  - Headword (primary text).
  - Translation or `latestSnapshot.analysis.layer1.definition` snippet as secondary text when available.
  - Short context or example (from snapshot or `example`).
  - Stage bar (existing 5-block visualization) + descriptive label.
  - Favorite icon button (star/bookmark) aligned right.
  - Delete icon or text button.
- Interactions:
  - Click on the **card body** opens the saved entry view (see §7.3).
  - Clicking the favorite icon calls `wordbook.toggleFavoriteByWord(entry.word)`; event should stop propagation so it does not open the detail view.
  - Clicking delete:
    - `if (window.confirm('确定删除这个单词条目吗？此操作不可撤销。')) wordbook.deleteEntry(entry.id);`
    - Also update pagination (e.g. clamp page index).

### 7.3 Saved-entry detail view & navigation

We need a way to display a saved entry’s explanation using the same components as the live coach view, plus a small link section at the top.

High-level approach:

- Extend `App.tsx` view state:

```ts
type View = 'coach' | 'profile' | 'saved-entry';
const [view, setView] = useState<View>('coach');
const [activeEntryId, setActiveEntryId] = useState<string | null>(null);
```

- Pass a callback into `ProfilePage`:

```ts
<ProfilePage
  /* existing props */
  onOpenWordbookEntry={(id) => {
    setActiveEntryId(id);
    setView('saved-entry');
  }}
/>
```

- In `ProfilePage`:
  - Add prop `onOpenWordbookEntry: (id: string) => void`.
  - On card click: `onOpenWordbookEntry(entry.id)`.

- Implement a new component (or inline block) in `App.tsx` to render `view === 'saved-entry'`:
  - Look up active entry:

    ```ts
    const wordbook = useWordbook();
    const activeEntry = wordbook.entries.find((e) => e.id === activeEntryId);
    const snapshot = activeEntry?.latestSnapshot;
    ```

  - If missing, fall back to `EmptyState` or back to profile.
  - Use the same layout as the live coach view:
    - Header (`Header`) with `word`, `pronunciation`, `definition`.
    - `CoachSummary`, `CognitiveScaffolding`, `CommonMistakes` rendered from `snapshot.analysis`.
    - No streaming, no calls to `startAnalysis`; this is a read-only view.
  - Pass `favoriteWords` and `onLexicalMapShown` as in the live view so mastery increments still work when revisiting entries if desired.

### 7.4 Top link entry for original page

Requirement: in the saved-entry view, add a small entry at the top to open the original link.

- Use `snapshot.request.url` and `snapshot.request.context`.
- At the top of the saved-entry view (above `Header`), render a slim bar:
  - Show host and possibly a truncated title/context:
    - E.g., “来自：example.com — 在原页面查看这句话”.
  - A button “打开原文链接”.
- On click:
  - Use `chrome.tabs.create({ url })` if available directly, or send a message to background (for consistency with other behaviors) e.g.:

    ```ts
    chrome.runtime.sendMessage({
      type: 'LEXILENS_OPEN_SAVED_ENTRY_URL',
      url: snapshot.request.url,
    });
    ```

  - Background handler:
    - Opens the URL in a new tab or brings an existing tab with that URL to front.
    - No additional logic for rehighlighting the word in this iteration.
- Highlighting requirement:
  - In the saved-entry view, visually mark the active entry in the Profile wordbook list (when the user returns) by:
    - Maintaining `activeEntryId` and passing it into `ProfilePage` as `activeEntryId`.
    - Applying a different background or border to that card when its `entry.id === activeEntryId`.

## 8. Lexical Map Images & Persistence (requirement 1)

We must ensure that any Lexical Map image generated for a word is saved under that word’s snapshot.

Integration points in `CognitiveScaffolding.tsx`:

- Add prop `onImageGenerated?: (params: { baseWord: string; relatedWord: string; imageUrl: string; prompt?: string }) => void`.
- In `handleGenerateImage`:
  - After a successful `fetchLexicalImage` call and `setImageState`:

    ```ts
    onImageGenerated?.({
      baseWord,
      relatedWord,
      imageUrl: json.image_url,
      prompt: json.prompt,
    });
    ```

- In `App.tsx`:
  - When rendering `CognitiveScaffolding` (for both live and saved-entry views), pass:

    ```ts
    <CognitiveScaffolding
      data={analysisResult.layer4}
      word={analysisResult.word || currentWord || ''}
      favoriteWords={favoriteWords}
      onImageGenerated={({ baseWord, relatedWord, imageUrl, prompt }) => {
        wordbook.recordLexicalImage({
          word: analysisResult.word || currentWord || '',
          baseWord,
          relatedWord,
          imageUrl,
          prompt,
        });
      }}
      onLexicalMapShown={() =>
        wordbook.incrementStageForWord(analysisResult.word || currentWord || '', 'lexical-map')
      }
    />
    ```

This ensures:
- For each explanation, we have:
  - A persisted snapshot of all textual layers.
  - A growing collection of lexical images tied to specific base/related word pairs.

## 9. Files to Modify / Create

Primary frontend changes:
- `extension/src/shared/types.ts`
  - Extend `AnalysisRequest` with `favoriteWords?`.
  - Add `WordbookSnapshot` interface.
  - Extend `WordbookEntry` with new fields.
- `extension/src/shared/constants.ts`
  - Optionally add `MAX_WORDBOOK_ENTRIES`, `MAX_SNAPSHOTS_PER_WORD`.
  - Update `DEMO_WORDBOOK` to include `createdAt`, `updatedAt`, and `isFavorite` as appropriate.
- `extension/src/sidepanel/hooks/useWordbook.ts`
  - Implement extended `UseWordbookResult` and new methods.
  - Update `sanitizeEntries` and persistence logic.
- `extension/src/sidepanel/hooks/useStreamingAnalysis.ts`
  - Accept `options?: { onAnalysisComplete?: (request: AnalysisRequest) => void }`.
  - Invoke callback after successful completion (and before returning) for non-aborted runs.
- `extension/src/sidepanel/hooks/useAnalysisPersistence.ts` (new)
  - Custom hook that wires `useWordbook` and `useAppStore` into a simple `onAnalysisComplete` handler.
- `extension/src/components/Header.tsx`
  - Extend props with `isFavorite`.
  - Toggle icon & tooltip based on favorite state.
- `extension/src/components/CognitiveScaffolding.tsx`
  - Extend props with `favoriteWords`, `onImageGenerated`, `onLexicalMapShown`.
  - Update `selectPreferredRelatedIndex` to consider favorites.
  - Fire callbacks as described.
- `extension/src/sidepanel/App.tsx`
  - Use `useWordbook` at top level (in addition to ProfilePage).
  - Compute `favoriteWords` and `isFavorite` for the active word.
  - Pass proper handlers to `Header` and `CognitiveScaffolding`.
  - Introduce `view: 'coach' | 'profile' | 'saved-entry'` state and `activeEntryId`.
  - Render saved-entry detail view when appropriate.
- `extension/src/sidepanel/ProfilePage.tsx`
  - Change Wordbook section to use `sortedEntries` and pagination.
  - Add favorite icon and delete action per card.
  - Accept `onOpenWordbookEntry` and `activeEntryId` props and wire interactions.

Backend (optional but recommended for requirement 2):
- `backend/app/models/request.py`
  - Extend `AnalyzeRequest` with `favorite_words: Optional[List[str]]`.
- `backend/app/prompt_config.py`
  - Add a `favorites_note_template` under `"layer4"`.
  - Update `user_prompt_template` to include a note about favorites.
- `backend/app/services/prompt_builder.py`
  - Extend `build_layer4_prompt` and `get_all_prompts` signatures to accept `favorite_words`.
  - Render favorites note in the prompt when non-empty.
- `backend/app/services/llm_orchestrator.py`
  - Pass `request.favorite_words` into `build_layer4_prompt`.

## 10. Verification Plan

### 10.1 Automated checks

Frontend:
- From `extension/`:
  - `pnpm lint` – TypeScript + ESLint should pass after all changes.
  - `pnpm typecheck` – Ensure new types (`WordbookEntry`, `AnalysisRequest`) and hooks are correctly wired.
  - `pnpm build` – Confirm extension builds successfully.

Backend:
- From `backend/`:
  - `poetry run pytest` (or project’s standard test command) – ensure any request model/prompt changes don’t break tests.
  - `poetry run uvicorn app.main:app --reload` (for manual testing).

### 10.2 Manual end-to-end tests

1. **Basic wordbook entry creation**
   - Open a page, select a word not yet in wordbook.
   - Trigger LexiLens; wait for analysis to finish.
   - Open Profile → Wordbook:
     - Verify a new entry appears with the headword.
     - Verify stage is `2` (initial `1` + one analysis exposure) or otherwise consistent with spec.

2. **Favorites behavior**
   - In the coach view, click the header favorite button.
   - Confirm:
     - The icon state toggles.
     - Profile wordbook marks the entry as favorite and sorts it to the top.
   - Un-favorite and verify list order updates.

3. **Saved entry detail view**
   - From Profile, click a wordbook card.
   - Confirm:
     - View switches to saved-entry detail.
     - Header, CoachSummary, CommonMistakes, Lexical Map render using stored data (no API calls).
     - A top bar shows an “open original link” action when URL is available.

4. **Open original link**
   - In saved-entry view, click the “open original link” button.
   - Confirm:
     - A new tab opens with the saved URL (or an existing one is focused).
     - The corresponding wordbook entry remains highlighted when going back to Profile.

5. **Lexical Map images persistence**
   - For a word with related words, open its Lexical Map.
   - Generate an image for one related word.
   - Reload the extension and open the same saved entry:
     - Confirm the Lexical Map detail shows the previously generated image without re-calling the API (if we choose to preload from stored image URL).

6. **Mastery increments**
   - Note a word’s stage in Profile.
   - Trigger a new explanation for that word; confirm stage increased by 1 (up to max 5).
   - Open its Lexical Map; confirm another increment (once per map view).

7. **Favorites influencing Lexical Map**
   - Mark some related words as favorites (for words that also exist in the wordbook).
   - Trigger analysis for a new word where those appear in layer4:
     - Confirm the default selected node for image warmup favors favorites over non-favorites when all else is equal.

8. **Favorites in prompts (if backend extended)**
   - With favorites defined, inspect the backend logs or temporary debugging output of prompts to confirm:
     - `favorite_words` are included in the layer4 prompt.
     - Personalized coaching mentions or relates to favorites reasonably often.

### 10.3 Edge cases

- Behavior when `chrome.storage.local` is unavailable:
  - `useWordbook` should fall back to in-memory entries using `DEMO_WORDBOOK` like other hooks.
- Migration:
  - Existing demo entries load without crashing; new fields (favorite, snapshots) simply appear unset until first update.
- Pagination:
  - Correct behavior when deleting items at the end of the list or when toggling favorites reshuffles order.

---

This spec provides the structure for:
- Persisting full explanation snapshots (including Lexical Map images) per word.
- Adding a “favorite” concept that carries through to Profile, prompts, and Lexical Map behavior.
- Managing the wordbook from the Profile page with sorting, pagination, and entry-level actions.
