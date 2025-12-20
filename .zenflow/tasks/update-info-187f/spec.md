# Update Info – Technical Specification

## 1. Context and Scope

This task updates the LexiLens sidepanel (Chrome extension React app + FastAPI backend) so that:
- The user’s quoted sentence is previewed in a compact way with full text on hover.
- A short Cobuild-style English explanation appears directly under the headword.
- The first main explanation section becomes Chinese-first and personalized.
- The social-media/news examples section is removed, and the Lexical Map is surfaced earlier.
- The light/dark display mode toggle is moved to the user profile banner, and its old spot gets a stub “add to word list” icon.

The focus is on UX simplification, clearer hierarchy, and using learner profile (English level, history) in prompts.

## 2. Current Architecture (Relevant Parts)

- **Extension front-end**
  - React 18 + TypeScript + Vite + Tailwind, in `extension/`.
  - Sidepanel root: `src/sidepanel/App.tsx`.
  - State: `zustand` store in `src/store/appStore.ts`.
  - Analysis flow:
    - Content script (`src/content/content-script.ts`) detects selections, builds `{ word, context, pageType, url }`.
    - Background (`src/background/service-worker.ts`) tracks last selection and sidepanel state.
    - Sidepanel `App` listens to `WORD_SELECTED` messages and calls `useStreamingAnalysis.startAnalysis`.
    - `useStreamingAnalysis` streams SSE from backend `/api/analyze` and incrementally populates:
      - `layer1`: `BehaviorPattern` (Cobuild-style English definition string).
      - `layer2`: `LiveContexts` (social, news, academic examples).
      - `layer3`: `CommonMistakes`.
      - `layer4`: `CognitiveScaffolding` (Lexical Map + `personalizedTip`).
  - UI components (used in `App.tsx`):
    - `Header`: shows word + IPA + pronunciation icon + theme toggle.
    - `UserProfileCard`: shows nickname + CEFR level.
    - `BehaviorPattern`: first explanation card – English definition.
    - `LiveContexts`: social media/news/academic examples.
    - `CommonMistakes`: wrong/why/correct cards.
    - `CognitiveScaffolding`: Lexical Map visualization + “个性化学习建议” card.

- **Backend**
  - FastAPI app (`backend/app`), SSE streaming endpoint `POST /api/analyze` (`app/api/routes/analyze.py`).
  - Request model `AnalyzeRequest` (`app/models/request.py`):
    - `word`, `context`, optional `page_type`, `learning_history`.
  - LLM orchestration (`app/services/llm_orchestrator.py`):
    - `generate_layer1_stream` streams plain text definition using `PromptBuilder.build_layer1_prompt`.
    - `generate_layer2/3/4` call `PromptBuilder.build_layer{2,3,4}_prompt` and parse JSON via `OpenRouterClient.complete_json`.
  - Prompt builder (`app/services/prompt_builder.py`):
    - `build_layer1_prompt`: Cobuild-style single-sentence definition, uses `word` and `context`.
    - `build_layer2_prompt`: three example sentences (twitter/news/academic).
    - `build_layer3_prompt`: common mistakes list.
    - `build_layer4_prompt`: related words + `personalized` field in Simplified Chinese; uses `learning_history` if present.

## 3. Requirements → Design Mapping

1. **Quoted sentence truncation with hover**
   - Display the user’s original context (the `context` field sent to `/api/analyze`) in the sidepanel, but truncate it beyond a threshold.
   - On hover, show the full sentence/context.
   - Keep the UI lightweight and non-distracting.

2. **Cobuild-style English explanation under the headword**
   - Under the word in the header, show a short Cobuild-style English explanation (≤ ~100 words) based on:
     - The LLM’s layer1 Cobuild-style definition.
     - The original context sentence.
     - The learner’s English level (CEFR) incorporated into the prompt, not guessed by the client.
   - Visual requirements:
     - Separated from the headword with a subtle divider line.
     - Different font size/weight from the main word (smaller, calmer).

3. **First explanation section: Chinese-first + user preferences + learning tip**
   - The first main body section (currently `BehaviorPattern`) should become Chinese-first and feel like a coach talking to the learner.
   - This section should:
     - Incorporate learner-specific information (preferences) – at minimum:
       - CEFR English level from `UserProfile.englishLevel`.
       - Learning history passed as `learning_history` to the backend.
     - Include the “personalized learning tip” content that is currently rendered as the last section inside `CognitiveScaffolding` (the `personalizedTip` field from layer4).
   - Result: a single, Chinese-focused “coach summary/learning suggestion” card that appears as the first substantial card below the header.

4. **Remove social media/news section, surface Lexical Map earlier**
   - Remove the “Live Contexts” section (social media/news/academic examples) from the UI.
   - After the first Chinese explanation section, show the Lexical Map section.
   - Lexical Map interaction (related-word nodes, text vs image view) stays functionally the same.
   - Decide whether the backend still generates layer2:
     - Default: keep generating for now to avoid backend changes to streaming order; simply don’t render layer2 on the client.
     - Optionally (future optimization): add a toggle/server flag to skip layer2 for latency/cost.

5. **Move display mode toggle and add “add to vocabulary” icon**
   - “Display mode toggle” here is the light/dark theme toggle currently rendered in `Header` (Sun/Moon icon).
   - Move this toggle into the right side of the `UserProfileCard` banner so theme selection clearly belongs to user preferences.
   - In the header, at the old theme-toggle spot (right side, near the word), show a new “加入生词表” icon.
     - This is purely a UI stub for now:
       - It may have a tooltip and/or a disabled-like visual state.
       - No persistence or backend calls yet.

6. **Overall UX/UI style**
   - Keep the layout very clean and bright; avoid additional visual noise.
   - Maintain the existing “glass” card style, but:
     - Reduce section headers, emphasize one clear primary section at a time.
     - Ensure vertical rhythm is consistent (spacing, padding).
     - Ensure all new elements look good in both light and dark themes.

## 4. Proposed Implementation

### 4.1 Data and API Changes

#### 4.1.1 Front-end types and state

1. **AnalysisRequest: add English level**
   - File: `extension/src/shared/types.ts`
   - Extend `AnalysisRequest`:
     - Add optional `englishLevel?: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';`
   - Usage:
     - `App.tsx` will populate `englishLevel` from `useUserProfile().profile.englishLevel` when calling `startAnalysis`.
     - `useStreamingAnalysis` sends `english_level` to the backend as part of the JSON payload.
   - Background/content-script code that reuses `AnalysisRequest` remains valid because the new field is optional.

2. **Store the current context in the app store**
   - File: `extension/src/store/appStore.ts`
   - Add `currentContext: string | null` to `AppState`.
   - Add setter `setCurrentContext: (context: string | null) => void;`.
   - Initialize `currentContext: null` in the store and reset it in `reset()`.
   - `useStreamingAnalysis.startAnalysis` will call `setCurrentContext(request.context)` at the start of a new analysis.

3. **Use the stored context in the UI**
   - `App.tsx` will read `currentContext` from `useAppStore()` and pass it down to `Header` for display.

#### 4.1.2 Backend request model

1. **AnalyzeRequest: add english_level**
   - File: `backend/app/models/request.py`
   - Extend `AnalyzeRequest` with:
     - `english_level: Optional[str] = Field(None, description="Learner CEFR level, e.g. 'B1'")`
   - Keep it optional so older clients remain compatible.

2. **Propagation inside orchestrator**
   - File: `backend/app/services/llm_orchestrator.py`
   - In `analyze_streaming`, extract:
     - `english_level = request.english_level`
   - Pass `english_level` into:
     - `generate_layer1_stream(word, context, english_level)`
     - `generate_layer4(word, context, learning_history, english_level)`
   - These methods will gain an optional `english_level` argument (see 4.2.2).

### 4.2 Backend Prompt and Orchestrator Logic

#### 4.2.1 Layer 1: Cobuild-style English explanation tuned by level

- File: `backend/app/services/prompt_builder.py`
- Change `build_layer1_prompt` signature to:
  - `def build_layer1_prompt(word: str, context: str, english_level: str | None = None) -> tuple[str, str]:`
  - Keep the third argument optional so any existing 2-arg calls still work.
- Prompt changes:
  - Keep system prompt “Cobuild-style lexicographer”.
  - Update user prompt to:
    - Explicitly reference `english_level` when provided, e.g.:
      - “The learner’s approximate CEFR level is B1. Use language that is natural and accessible for this level.”
    - Keep it *single coherent explanation*, but explicitly say:
      - “The explanation must be at most 100 words.”
    - Continue to:
      - Avoid using the headword itself.
      - Integrate the provided `context` so the sentence fits the situation.
- Orchestrator:
  - Update `generate_layer1_stream` signature to accept `english_level`.
  - Call `self.prompt_builder.build_layer1_prompt(word, context, english_level)`.
  - Streaming shape (`layer1_chunk` and `layer1_complete` events with `{ content: str }`) remains unchanged, so the front-end continues to accumulate into `analysisResult.layer1.definition`.

#### 4.2.2 Layer 4: Chinese-first personalized coaching tuned by level

- `PromptBuilder.build_layer4_prompt`:
  - Update signature to:
    - `def build_layer4_prompt(word: str, context: str, learning_history: list[str] | None = None, english_level: str | None = None) -> tuple[str, str]:`
    - Keep `learning_history` positional as today; `english_level` stays optional at the end to preserve existing callers (including tests).
  - In addition to existing `history_note`, add a `level_note` when `english_level` is present, e.g.:
    - “The learner’s approximate CEFR English level is B1; write the personalized coaching in Simplified Chinese at an appropriate difficulty for this level.”
  - Ensure the JSON spec still includes:
    - `related_words` array.
    - `personalized` field in Simplified Chinese (1–3 short sentences).
  - Continue to allow `difference` / `when_to_use` to be in English.

- `LLMOrchestrator.generate_layer4`:
  - Accept optional `english_level` and pass it into `build_layer4_prompt`.
  - Output mapping stays the same:
    - `related_words` → `related_words` list.
    - `personalized` → `personalized` string.
  - Front-end already maps this to `CognitiveScaffolding.relatedWords` and `.personalizedTip`.

- **Tests**:
  - File: `backend/tests/test_prompt_builder.py`
    - Existing calls to `PromptBuilder.build_layer4_prompt` should still compile (no changes needed to the call sites if we keep the new arg optional).
    - Optionally extend tests to assert that when `english_level` is passed, the prompt contains that level string (to be done in the implementation step).

### 4.3 Front-end UI and Component Changes

#### 4.3.1 Header: context preview + Cobuild explanation

- File: `extension/src/components/Header.tsx`
- New props:
  - `definition?: string;` – the Cobuild-style definition from `analysisResult.layer1.definition`.
  - `context?: string;` – the original context snippet from `currentContext` in the store.
  - `onAddToWordlistClick?: () => void;` (optional, likely a stub now).
- Move theme toggle out:
  - Remove `theme` and `onToggleTheme` usage from the header’s right-hand controls.
  - Keep `onClose` support as-is.
- Add “加入生词表” icon in previous theme-toggle spot:
  - Import a suitable Lucide icon (e.g. `BookmarkPlus`).
  - Render it to the right of the word with:
    - A small button-style affordance.
    - Tooltip/title like `加入生词表（即将上线）` to signal that functionality is coming soon.
  - For now, either:
    - Do nothing on click, or
    - Call `onAddToWordlistClick` if provided (which `App` can stub as a console log).
- Under the word, render:
  - A compact context preview row:
    - Use existing `truncateText` helper from `src/shared/utils.ts` with a fixed max length (e.g. 140–160 characters).
    - Wrap in a `p` with `truncate` / small font classes.
    - Set `title={context}` so hovering shows the full sentence/context in the default browser tooltip.
  - A divider + definition:
    - A thin border-top (`border-gray-200` / `dark:border-gray-700`) with `pt-1`/`pt-2`.
    - Below it, render `definition` in `text-sm` (smaller than the 3xl headword), more neutral color (e.g. `text-gray-700`).
    - Only render these blocks when the corresponding props are non-empty.

- File: `extension/src/sidepanel/App.tsx`
  - Pass `definition` and `context` to `Header`:
    - `definition={analysisResult?.layer1?.definition}`
    - `context={currentContext ?? ''}`
  - Stop passing theme props to `Header` (theme will move to `UserProfileCard`).

#### 4.3.2 First explanation section: Chinese-first + preferences + learning tip

- Create a new component, e.g. `extension/src/components/CoachSummary.tsx`:
  - Props:
    - `word: string;`
    - `personalizedTip?: string;` – from `analysisResult.layer4?.personalizedTip`.
    - `profile: UserProfile;` – from `useUserProfile`.
  - Behavior:
    - If `personalizedTip` is absent, render nothing (or a very light placeholder).
    - Display a glass card section with:
      - Header row (small label) like: “学习教练 · 中文解读”.
      - Inside, short Chinese text:
        - One paragraph that lightly references `profile.englishLevel` (e.g. “以你目前的 B1 水平，可以重点注意…”).
        - The body of the card is `personalizedTip`.
      - Ensure Chinese is the primary language (no large English blocks; English words only as examples).
    - Keep the visual style simple and in line with other cards (rounded glass, modest icon).

- `App.tsx`:
  - Import and render `CoachSummary` as the first section after `Header`:
    - `<CoachSummary word={...} personalizedTip={analysisResult?.layer4?.personalizedTip} profile={profile} />`
  - This section now conceptually replaces “first explanation section”.

- `CognitiveScaffolding.tsx`:
  - Remove the bottom “个性化学习建议” callout card that currently uses `data.personalizedTip`.
  - The Lexical Map (graph + text/image explanation) remains intact.
  - Accept that `data.personalizedTip` may still be present but is not rendered here anymore; it is consumed by `CoachSummary` via `analysisResult.layer4` in `App.tsx`.

#### 4.3.3 Remove Live Contexts and adjust ordering

- `App.tsx`:
  - Remove rendering of the `LiveContexts` component:
    - Delete the block that checks `analysisResult?.layer2` and renders `<LiveContexts contexts={analysisResult.layer2} />`.
  - Adjust order of sections inside the main scroll area to:
    1. `CoachSummary` (Chinese-first).
    2. `CognitiveScaffolding` (Lexical Map).
    3. `CommonMistakes`.
  - Keep loading spinner behavior and error handling unchanged.

- `LiveContexts.tsx`:
  - Component can remain in the codebase for now but is unused.
  - No change to backend layer2 streaming; the UI simply ignores it.

#### 4.3.4 Theme toggle relocation

- File: `extension/src/components/UserProfileCard.tsx`
  - Import `Theme` type and optional theme props:
    - `import type { Theme } from '../sidepanel/hooks/useTheme';`
  - Extend props:
    - `theme?: Theme;`
    - `onToggleTheme?: () => void;`
  - Import `Sun` and `Moon` icons from `lucide-react`.
  - Layout:
    - Turn the top-level section into `flex items-center justify-between`.
    - Left side: existing avatar + name + level pill (unchanged).
    - Right side:
      - If `onToggleTheme` is provided, render a circular button with:
        - Sun icon in dark mode, Moon icon in light mode (same logic as the old header).
        - Tooltip like “切换深浅模式”.

- File: `extension/src/sidepanel/App.tsx`
  - Pass theme props into `UserProfileCard`:
    - `<UserProfileCard profile={profile} theme={theme} />` is not enough; the card needs `onToggleTheme`.
    - Use: `<UserProfileCard profile={profile} theme={theme} onToggleTheme={toggleTheme} />`.
  - Remove theme props from `Header`.

#### 4.3.5 Wiring `AnalysisRequest.englishLevel`

- `extension/src/sidepanel/App.tsx`
  - When building `request: AnalysisRequest` in `handleSelection`, include:
    - `englishLevel: profile.englishLevel`.
- `extension/src/sidepanel/hooks/useStreamingAnalysis.ts`
  - When sending the POST body for `/api/analyze`, add:
    - `english_level: request.englishLevel`.
  - No other behavior changes; streaming and layer mapping stay the same.

#### 4.3.6 UX and styling polish

- Ensure new/adjusted elements use existing Tailwind utilities:
  - Maintain `glass` + `glass-border` for main cards.
  - Use consistent `px-6 py-4` spacing for sections.
  - Avoid introducing new complex visual elements or animation; re-use existing motion settings where needed.
- Careful with Tailwind plugins:
  - Avoid `line-clamp-*` utilities since the plugin is not configured; use `truncate`/`overflow-hidden` instead.

### 4.4 Source Files to Modify/Create

**Extension (front-end)**
- Modify:
  - `extension/src/shared/types.ts` – add `englishLevel` to `AnalysisRequest`.
  - `extension/src/store/appStore.ts` – add `currentContext` + setter.
  - `extension/src/sidepanel/hooks/useStreamingAnalysis.ts` – store context, send `english_level`.
  - `extension/src/sidepanel/App.tsx` – new props to `Header`/`UserProfileCard`, build `englishLevel`, change section ordering, remove `LiveContexts`.
  - `extension/src/components/Header.tsx` – add context preview + Cobuild explanation, move theme toggle out, add “add to word list” icon.
  - `extension/src/components/UserProfileCard.tsx` – add theme toggle to the right of the banner.
  - `extension/src/components/CognitiveScaffolding.tsx` – remove in-component rendering of `personalizedTip` card.
  - Optionally: `extension/src/components/index.ts` – export new components if needed.
- New:
  - `extension/src/components/CoachSummary.tsx` – Chinese-first personalized coaching card.

**Backend**
- Modify:
  - `backend/app/models/request.py` – add `english_level` to `AnalyzeRequest`.
  - `backend/app/services/prompt_builder.py` – extend `build_layer1_prompt` and `build_layer4_prompt` to accept `english_level` and include it in prompts; update `get_all_prompts`.
  - `backend/app/services/llm_orchestrator.py` – pass `english_level` from `AnalyzeRequest` into layer1 and layer4 generation.
  - `backend/tests/test_prompt_builder.py` – (optional) extend tests to cover level-aware prompts.

## 5. Verification Plan

### 5.1 Automated checks

- **Extension**
  - From `extension/`:
    - `pnpm lint`
    - `pnpm typecheck`
    - `pnpm build`
  - Confirm no type errors from updated props/types and that the bundle builds successfully.

- **Backend**
  - From `backend/`:
    - `poetry run ruff check app/`
    - `poetry run mypy app/`
    - `poetry run pytest tests/ -v`
  - Ensure prompt-builder tests pass and any new tests for `english_level` behavior are green.

### 5.2 Manual UI verification

In a dev environment with both backend and extension running:

1. **Selection and context preview**
   - Select a long sentence on a web page.
   - Open the LexiLens sidepanel.
   - Verify:
     - The selected context appears under the headword, truncated.
     - Hovering shows the full sentence in a tooltip.

2. **Cobuild English explanation**
   - Confirm a Cobuild-style English explanation appears under the context, separated by a divider, and is visually distinct from the word (smaller text).

3. **Chinese-first coach section**
   - After streaming stabilizes, verify the first main card below the header is a Chinese-first explanation containing personalized coaching.
   - Confirm it feels consistent with the learner’s CEFR level (e.g. simple wording for A1–B1).

4. **Lexical Map and Common Mistakes**
   - Verify that Live Contexts no longer appear.
   - Confirm the Lexical Map behaves as before (related word buttons, text/image toggle, image generation).
   - Confirm Common Mistakes still render after Lexical Map if layer3 data is present.

5. **Theme toggle and add-to-wordlist icon**
   - Check that the theme toggle now appears on the right side of the user profile banner and still switches light/dark mode.
   - Confirm the header shows an “加入生词表” icon where the theme toggle used to be, with appropriate tooltip, and that clicking it does not break anything (no actual saving yet).

6. **Light/dark theme**
   - Manually toggle between themes and verify:
     - New context preview, Cobuild definition, and coach section remain readable.
     - No background/foreground color clashes.

### 5.3 Edge cases

- Very short or missing context:
  - If `context` is empty/null, the context preview row should be hidden.
- Slow or missing layer4:
  - If `personalizedTip` is missing (layer4 error), `CoachSummary` should gracefully hide rather than show placeholder gibberish.
- Repeated selections:
  - Ensure the debouncing/dedup logic in `App.tsx` still works; repeated selection of the same word/context should not spam the backend or break the UI.

## 6. Complexity Assessment

- **Overall difficulty: medium**
  - Requires coordinated changes across front-end and backend (types, prompts, SSE client).
  - UI changes are localized but include layout adjustments and new component wiring.
  - Backwards compatibility must be preserved for streaming and JSON structures.

