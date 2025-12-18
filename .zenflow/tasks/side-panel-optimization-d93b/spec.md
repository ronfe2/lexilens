# Side Panel Optimization – Technical Specification

## 1. Context and Current Architecture

- **Product**: LexiLens Chrome extension (MV3) plus FastAPI backend.
- **Frontend (extension)**:
  - Bundler: Vite + React 18 + TypeScript.
  - Styling: TailwindCSS (see `extension/tailwind.config.js`, `src/sidepanel/styles/global.css`).
  - State: Zustand store in `src/store/appStore.ts`.
  - Entry points:
    - Side panel UI: `src/sidepanel/main.tsx` → `src/sidepanel/App.tsx`.
    - Content script: `src/content/content-script.ts`.
    - Background service worker: `src/background/service-worker.ts`.
  - Shared types/utilities: `src/shared/types.ts`, `src/shared/utils.ts`, `src/shared/constants.ts`.
  - API integration & streaming: `src/sidepanel/hooks/useStreamingAnalysis.ts`.
- **Backend**:
  - FastAPI app in `backend/app/main.py`.
  - LLM orchestration in `backend/app/services/llm_orchestrator.py`.
  - Prompt construction in `backend/app/services/prompt_builder.py`.
  - Pydantic models in `backend/app/models/request.py` and `backend/app/models/response.py`.
  - SSE streaming helper in `backend/app/utils/streaming.py`.

### Current UX/Data Flow

1. **Selection → Content Script**
   - `content-script.ts` listens for `mouseup` (short selection `< 100` chars) and `dblclick` (any length).
   - Builds a payload with `word`, `context` (smartly extracted sentence/paragraph), `pageType`, and `url`.
   - Sends `chrome.runtime.sendMessage({ type: 'WORD_SELECTED', data: payload })` (debounced).

2. **Background service worker**
   - `service-worker.ts` listens for `WORD_SELECTED`, stores `lastSelection`, and always calls `openSidePanelFromMessageSender(sender)` to open or focus the side panel.
   - On `SIDE_PANEL_READY` (from side panel), responds with `lastSelection` so the current selection can be replayed.
   - On `chrome.action.onClicked`, opens the side panel for the current tab.

3. **Side panel React app**
   - `App.tsx` calls `chrome.runtime.sendMessage({ type: 'SIDE_PANEL_READY' })` on mount.
   - Listens for `WORD_SELECTED` messages to trigger `handleSelection`, which builds an `AnalysisRequest` and calls `useStreamingAnalysis().startAnalysis`.
   - `useStreamingAnalysis` streams SSE events from the backend (`layer1_chunk`, `layer1_complete`, `layer2`, `layer3`, `layer4`, `done`) and updates the Zustand store.
   - UI components:
     - `BehaviorPattern` (Layer 1), `LiveContexts` (Layer 2), `CommonMistakes` (Layer 3),
       `CognitiveScaffolding` (Layer 4).
     - `CognitiveScaffolding` currently shows a **Lexical Map** SVG plus a list of detailed related-word cards and an optional `personalizedTip` card.

4. **Backend**
   - `AnalyzeRequest` includes `word`, `context`, `page_type`, and `learning_history`.
   - `Layer4Response` contains `related_words` and an optional `personalized` string.
   - `PromptBuilder.build_layer4_prompt` currently allows a `personalized` field only in a narrow, strategy/tactic-specific case, and does not specify language.

## 2. Requirements Clarification

1. **Side panel behavior**
   - When the browser opens, the side panel should be automatically opened and fixed (pinned).
   - After the user **closes** the side panel:
     - Selecting text **must not** automatically reopen the side panel.
     - Instead, the user should double-click the selected content to open the side panel and show the explanation for that selection.

2. **Side panel layout & personalization**
   - Show **user info**: avatar, nickname, and English proficiency level (A1–C2).
   - The **personalized explanation** part should be output in **Chinese**.
   - UI/UX refresh:
     - More modern and minimal.
     - Clear type hierarchy (font sizes/weights), color usage, and iconography.
     - Avoid dense text blocks.
   - **Next Steps** section:
     - By default, show only the **Lexical Map**.
     - Hide the detailed explanations initially.
     - When the user clicks a node in the Lexical Map, expand and show the corresponding explanation.

### Platform Constraints

- Chrome’s `sidePanel.open()` requires a user interaction context; we cannot guarantee a truly automatic open on browser startup with no user gesture.
- The **pinning** (fixed/pinned state) of the side panel is controlled by Chrome’s UI and the user; extensions cannot force-pin it.

Design will therefore:
- Ensure the side panel is automatically opened **in response to user actions** (e.g., text selection / double-click) and clearly guide users to pin it.
- Treat “auto-open on selection” as a **user preference** that is disabled once the user closes the panel, and can be re-enabled via explicit actions.

## 3. Complexity Assessment

- **Overall complexity: medium**.
  - Cross-context coordination between content script, background, and side panel (new behavior flags, trigger types, and panel open/close tracking).
  - UI refactor of the “Next Steps” section and new profile UI.
  - Backend prompt changes to guarantee Chinese output for personalized explanations.

## 4. Implementation Approach

### 4.1 Side Panel Behavior & Open/Close Logic

#### 4.1.1 Selection triggers and intent

Goal: Differentiate between a normal selection (single mouseup) and a strong-intent double-click, and only auto-open the panel on selection when allowed by user preference.

Approach:
- Extend the payload built in `src/content/content-script.ts`:
  - Update `buildContextPayload(text: string)` to accept a trigger argument:
    - `buildContextPayload(text: string, trigger: 'selection' | 'double-click')`.
  - Return object shape:
    - `word`, `context`, `pageType`, `url` (unchanged).
    - New field: `trigger: 'selection' | 'double-click'`.
- Update event listeners:
  - `mouseup` handler:
    - When selection length is within the existing limit, call `sendSelection(buildContextPayload(text, 'selection'))`.
  - `dblclick` handler:
    - Call `sendSelection(buildContextPayload(text, 'double-click'))` without length limit.
- The existing `debounce` implementation ensures that in the common case where double-click follows mouseup quickly, only the **last** call executes, so a double-click produces a single payload with `trigger: 'double-click'`.
- The message type stays `WORD_SELECTED` (to avoid changing the shared message contract); only the payload gains the `trigger` field.

Type considerations:
- `buildContextPayload` remains untyped at call sites; its return type is inferred and used in `ReturnType<typeof buildContextPayload>`.
- No changes to `AnalysisRequest` or backend request body; the `trigger` field is only used in extension messaging, not forwarded to the API.

#### 4.1.2 Tracking side panel open/close

Goal: Know when the user has closed the side panel so we can disable auto-open-on-selection until a stronger intent (double-click or explicit user action) re-enables it.

Approach:
- Use a long-lived `chrome.runtime` port from the side panel to the background:
  - In `src/sidepanel/main.tsx` (or a dedicated side panel bootstrap module):
    - On startup, create a port:
      - `const port = chrome.runtime.connect({ name: 'sidepanel' });`
      - Optionally send an initial message (`{ type: 'SIDE_PANEL_OPENED' }`) for logging.
    - When the window is unloading, allow Chrome to automatically disconnect the port (no extra work needed, but we can additionally call `port.disconnect()` defensively).
  - In `src/background/service-worker.ts`:
    - Add `chrome.runtime.onConnect.addListener(...)`:
      - If `port.name === 'sidepanel'`:
        - Set an in-memory flag `isSidePanelOpen = true`.
        - Set `autoOpenOnSelection = true` (user has explicitly opened the panel again).
        - Attach `port.onDisconnect.addListener(...)`:
          - On disconnect, set:
            - `isSidePanelOpen = false`.
            - `autoOpenOnSelection = false` (user has closed or navigated away; we stop auto-opening on plain selection).

Persistence:
- Introduce a simple preference key in `chrome.storage.local`, e.g. `lexilens_sidepanel_prefs` with `{ autoOpenOnSelection: boolean }`.
  - On service worker startup, read this key and initialize `autoOpenOnSelection` (default `true`).
  - In the `onDisconnect` handler, persist `{ autoOpenOnSelection: false }`.
  - Whenever the user explicitly opens the panel (double-click or clicking the extension icon), set and persist `{ autoOpenOnSelection: true }`.
- This ensures that the “selection opens side panel” behavior reflects the user’s last choice across browser restarts and service worker restarts.

#### 4.1.3 Deciding when to open the side panel

Goal: Implement the new rules:
- Initially: side panel auto-opens on selection.
- After the user closes the panel: selection no longer opens it, but double-click does.

Approach in `service-worker.ts`:

- Extend the `WORD_SELECTED` handler:
  - Read `trigger = message.data?.trigger ?? 'selection'`.
  - Update `lastSelection` exactly as today (no change to stored shape).
  - Determine whether to open the side panel:
    - `shouldOpenForSelection = autoOpenOnSelection && trigger === 'selection'`.
    - `shouldOpenForDoubleClick = trigger === 'double-click'`.
    - `shouldOpen = (shouldOpenForSelection || shouldOpenForDoubleClick) && !!sender.tab`.
  - If `shouldOpen`, call `openSidePanelFromMessageSender(sender)`:
    - After calling this helper successfully, set `autoOpenOnSelection = true` and persist it (the user is implicitly opting back into auto-open once they’ve invoked a strong-intent interaction).
- Extend `chrome.action.onClicked` handler:
  - Before or after calling `openSidePanelFromTab(tab)`, set `autoOpenOnSelection = true` and persist it (explicit user action to open the UI).

#### 4.1.4 “Auto-open on browser start” semantics

Given Chrome’s restrictions:

- **Best-effort behavior**:
  - On `chrome.runtime.onStartup`, query the current active tab and call:
    - `chrome.sidePanel.setOptions({ tabId, path: 'src/sidepanel/index.html', enabled: true })` inside a try/catch.
  - Optionally attempt `chrome.sidePanel.open({ tabId })`:
    - If `chrome.runtime.lastError` indicates a gesture requirement, log and ignore.
  - Ensure `autoOpenOnSelection` is initialized to the persisted preference (default `true`), so that the first word selection in a new session opens the side panel without additional clicks.
- **Pinned behavior**:
  - We cannot force pinning; we will:
    - Keep `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })` in `onInstalled`.
    - Optionally show a subtle in-panel hint (e.g., in `EmptyState` or header) explaining how to pin the side panel for a fixed layout.

### 4.2 Side Panel UI and Layout

#### 4.2.1 User profile section

Goal: Display user avatar, nickname, and English proficiency (A1–C2) in the side panel.

Data model:
- Frontend-only `UserProfile` interface, e.g. in a new file `src/shared/userProfile.ts` or inline in a hook:
  - `nickname: string`.
  - `englishLevel: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'`.
  - `avatarUrl?: string` (optional custom avatar).
- Storage:
  - Add a new key to `STORAGE_KEYS` in `src/shared/constants.ts`, e.g. `USER_PROFILE: 'lexilens_user_profile'`.
  - Default profile (used if nothing is stored):
    - `nickname`: e.g. `"Lexi Learner"`.
    - `englishLevel`: e.g. `"B2"`.
    - No avatar URL; derive avatar from the first letter of the nickname.

Hook:
- Add a new hook `src/sidepanel/hooks/useUserProfile.ts`:
  - Loads `USER_PROFILE` from `chrome.storage.local`.
  - Returns `{ profile, loading, updateProfile }`.
  - For now, only read is needed; `updateProfile` can be a no-op or a small helper for future settings UI.

UI component:
- Add `src/components/UserProfileCard.tsx`:
  - Props: `{ profile: UserProfile }`.
  - Layout:
    - Horizontal card with:
      - Circular avatar (initial-based if no image).
      - Nickname and level stacked vertically:
        - `nickname` as medium-weight text.
        - Level badge (e.g., pill “B2 · Upper-Intermediate”) with subdued background color and small icon.
  - Styling: Tailwind + existing `glass` utilities for a modern, minimal look.

Integration:
- In `src/sidepanel/App.tsx`:
  - Use `useUserProfile()` and render `<UserProfileCard>` near the top, likely above the `Header` or integrated into a combined header section.
  - Ensure the profile card does not crowd the word header:
    - For example, a top column layout:
      - User profile card.
      - Word header (pronunciation & theme toggle).

#### 4.2.2 Personalized explanation in Chinese

Goal: Ensure the personalized explanation section uses Chinese (Simplified) while keeping the rest of the UI language behavior intact.

Backend changes (see 4.3 for prompt details):
- `Layer4Response.personalized` will be explicitly defined as a **Chinese** personalized message.

Frontend changes:
- In `src/components/CognitiveScaffolding.tsx`:
  - The `personalizedTip` card currently renders `data.personalizedTip` directly with English copy context.
  - Update textual framing around this card to Chinese, e.g.:
    - Heading or subtle label like “个性化学习建议”.
  - Keep the actual content `data.personalizedTip` in Chinese as provided by the backend.
- No structural changes to `AnalysisResult` or `CognitiveScaffolding` types are required; only semantics and prompts change.

#### 4.2.3 “Next Steps” / Lexical Map behavior

Goal: Make the Next Steps section more modern and interactive:
- Initially show only the Lexical Map.
- Show detailed explanation only after the user clicks a node.

Current state:
- `CognitiveScaffolding` renders:
  - “Next Steps” heading.
  - Lexical Map (SVG cut-out) with nodes for up to 4 related words.
  - Optional `personalizedTip` card.
  - A list of detailed cards for **all** `relatedWords`, always visible.

Proposed behavior:
- Local state:
  - Add `const [selectedIndex, setSelectedIndex] = useState<number | null>(null);`.
  - Optionally, default-select the first related word once data arrives, or require an explicit click. To keep the UI minimal, start with `null` and show a prompt.
- Lexical Map:
  - Each node’s `motion.div` becomes interactive:
    - Add `onClick={() => setSelectedIndex(index)}`.
    - Add `role="button"`, `tabIndex={0}`, and `onKeyDown` handling for Enter/Space for accessibility.
    - Visually differentiate the selected node (e.g., thicker border, accent glow).
- Detailed explanation area:
  - Replace the full `data.relatedWords.map` list with:
    - If `selectedIndex === null`:
      - Show a compact helper text, e.g.:
        - “点击上面的词节点查看详细区别和使用场景。”
    - Else:
      - Render a single detailed card for `data.relatedWords[selectedIndex]`:
        - Keep the existing structure (word + relationship badge + key difference + when to use).
        - Optionally add Chinese labels for “Key difference” and “When to use” without changing the English content returned by the backend.
  - This ensures the default view is visually light and only expands when the user explicitly interacts with the Lexical Map.

Styling improvements:
- Use more consistent spacing (e.g., `space-y-4` instead of very tight sections).
- Review text sizes:
  - Section titles: `text-xs` or `text-sm` with uppercase tracking (as currently).
  - Body text: avoid long paragraphs; encourage bullet-like phrasing where feasible.
- Ensure components like `BehaviorPattern`, `LiveContexts`, `CommonMistakes`, and `CognitiveScaffolding` use a consistent `glass` panel style with adequate padding and margin.

### 4.3 Backend: Chinese Personalized Explanation

Goal: Ensure the personalized explanation part is returned in Chinese while keeping the rest of the backend JSON contract intact.

Changes in `backend/app/services/prompt_builder.py`:

- `build_layer4_prompt`:
  - Currently:
    - Focuses on English explanations.
    - Optionally includes a `personalized` field only for the specific strategy/tactic case.
  - Update the prompt text to:
    - Always **allow** a `personalized` field, not just in the special condition.
    - Explicitly instruct:
      - `personalized` must be written in **Simplified Chinese**.
      - It should be 1–3 short sentences directly addressing the learner, referencing their past words when `learning_history` is available.
    - Clarify that `difference` and `when_to_use` may remain in English for now, to minimize the scope of changes.
  - Update the “Return as JSON” block to include an optional `personalized` field with an example Chinese message, e.g.:
    - `"personalized": "用简体中文写一段 1-3 句的个性化学习建议，直接和学习者对话。"`
  - Keep the existing `related_words` structure so that `RelatedWord` mapping in `llm_orchestrator` and frontend remains unchanged.

Changes in `llm_orchestrator.generate_layer4`:
- No changes to the structure:
  - Continue to read `personalized = response.get("personalized")`.
  - Continue to pass `personalized` as-is into `Layer4Response`.
- The only change is semantic: the `personalized` string is now expected to be Chinese.

No API schema changes:
- `Layer4Response` and `AnalyzeResponse` models remain structurally the same.
- No version bumps to external API endpoints are necessary.

## 5. Source Files to Modify / Add

**Extension (frontend)**
- Modify:
  - `extension/src/content/content-script.ts`
    - Add `trigger` to selection payloads and propagate into `WORD_SELECTED` messages.
  - `extension/src/background/service-worker.ts`
    - Add connection handling (`onConnect` for the side panel port) and `autoOpenOnSelection` logic.
    - Add persistence of side panel behavior preference via `chrome.storage.local`.
    - Update `WORD_SELECTED` handler to respect `trigger` and `autoOpenOnSelection`.
    - Optionally handle `runtime.onStartup` for best-effort auto-open semantics.
  - `extension/src/sidepanel/App.tsx`
    - Integrate `UserProfileCard` and `useUserProfile` at the top of the panel.
  - `extension/src/components/CognitiveScaffolding.tsx`
    - Introduce `selectedIndex` state.
    - Make Lexical Map nodes interactive.
    - Hide detailed cards by default; only show the one corresponding to the selected node.
    - Adjust labels and text around the personalized tip to Chinese framing.
  - `extension/src/shared/constants.ts`
    - Add `USER_PROFILE` key and, if needed, a new key for side panel preferences (e.g. `SIDEPANEL_PREFS`).
- Add:
  - `extension/src/sidepanel/hooks/useUserProfile.ts`
    - Hook for loading/storing `UserProfile` from `chrome.storage.local`.
  - `extension/src/components/UserProfileCard.tsx`
    - Presentational component for avatar, nickname, and English level.

**Backend**
- Modify:
  - `backend/app/services/prompt_builder.py`
    - Update `build_layer4_prompt` with explicit instructions for Chinese `personalized` outputs and generalized personalization (not limited to strategy/tactic).

## 6. Verification Plan

### 6.1 Automated checks

- **Extension**:
  - From `extension/`:
    - `pnpm lint`
    - `pnpm typecheck`
    - `pnpm build`
- **Backend**:
  - From `backend/`:
    - `poetry run pytest tests/ -v`
    - `poetry run ruff check app/`

### 6.2 Manual QA (Chrome extension)

1. **Baseline behavior**
   - Load the built extension in Chrome.
   - Open a webpage with text.
   - Select a short word or phrase:
     - Verify the side panel opens (if not already) and streams analysis.

2. **Close-then-select behavior**
   - With the side panel open, close it via the Chrome UI.
   - Select a word/phrase with a normal drag and mouseup:
     - The side panel **must not** open.
   - Double-click the same selection:
     - The side panel should open.
     - The analysis shown should correspond to the double-clicked selection.

3. **Re-enabling auto-open**
   - After closing the side panel, open it via the extension icon.
   - Select a word:
     - Confirm that auto-open-on-selection is re-enabled according to the chosen design (if specified).

4. **User profile UI**
   - Verify that the top area of the side panel shows:
     - Avatar placeholder or image.
     - Nickname.
     - English level badge (A1–C2).
   - Confirm the layout remains clean and does not push critical content below the fold on typical side panel widths.

5. **Next Steps & Lexical Map**
   - Trigger an analysis that produces at least two related words.
   - In the side panel:
     - Confirm that initially only the Lexical Map (and possibly the personalized card) is visible in the Next Steps section.
     - Click each node:
       - The detailed card area should show only the explanation for the clicked word.
       - Visual highlight should indicate the selected node.

6. **Personalized explanation language**
   - Trigger words that include learning history (ensuring `learningHistory` is non-empty).
   - Confirm the personalized explanation card renders text in Simplified Chinese.

7. **Persistence of behavior**
   - Close and reopen the browser.
   - Verify that:
     - The extension still initializes correctly.
     - Side panel preferences (auto-open-on-selection) behave as expected based on the last close/open actions.

If any Chrome API limitations prevent fully automatic opening on browser start or programmatic pinning, document the observed behavior and ensure the UX copy sets correct expectations for users.

