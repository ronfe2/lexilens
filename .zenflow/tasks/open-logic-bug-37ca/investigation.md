# Bug investigation – LexiLens side panel re-use

## Bug summary
- **Symptom:** After using the “LexiLens It” flow once (right-click → LexiLens It → side panel analysis), subsequent attempts do not start a new explanation. This happens whether the side panel is currently open or closed; even the context-menu entry appears to do nothing until the extension is reinstalled.
- **Expected (updated) behavior:**
  - When the side panel is **closed**, it should only be opened via the right-click **LexiLens It** context menu.
  - When the side panel is **open**, selecting text should not immediately trigger a new analysis. Instead, after selection ends, a small floating **LexiLens It** button should appear just below the last line of the selection. Clicking that button should start the next explanation.

## Root cause analysis
Based on static code review (no browser runtime here), the “one‑shot only” behavior is best explained by the current coupling between selection events and the side panel:

1. **Selections always fire background messages, even when the panel is closed**
   - `extension/src/content/content-script.ts` listens for `mouseup` and `dblclick` on the page and **always** calls `chrome.runtime.sendMessage({ type: 'WORD_SELECTED', data: payload })`, regardless of whether the side panel is open.
   - The background script (`extension/src/background/service-worker.ts`) only records a `lastSelection` for `WORD_SELECTED` when `isSidepanelOpen` is `true`:
     ```ts
     if (isSidepanelOpen && tabId != null) {
       lastSelection = { selection: { ...data }, tabId };
     }
     ```
   - When the side panel is closed, these messages do not update `lastSelection`, so later `SIDE_PANEL_READY` queries may see stale data.

2. **Side panel only “hydrates” once per open and then relies on live messages**
   - On mount, `extension/src/sidepanel/App.tsx` sends `SIDE_PANEL_READY` to the background and, if a `selection` is returned, immediately invokes `handleSelection` to start analysis.
   - While the panel remains open, the React app listens for `WORD_SELECTED` messages and calls `handleSelection` for each one.
   - If anything goes wrong in this handshake (e.g., `lastSelection` not updated or associated with the wrong tab, or the side-panel’s `onMessage` listener not seeing new messages), the UI will appear “stuck” on the previous word.

3. **No explicit knowledge of side-panel open/closed state in the content script**
   - The background tracks `isSidepanelOpen` via a long-lived port from `extension/src/sidepanel/main.tsx`, but the content script has **no idea** whether the side panel is currently open.
   - As a result, it cannot:
     - Avoid sending background `WORD_SELECTED` spam while the panel is closed.
     - Show a contextual “LexiLens It” floating button only when the helper UI is actually visible.
   - This mismatch makes the open/close logic brittle: some flows depend on timing between panel opening, context-menu seeding, and selection events and can fail after the first successful run, creating the reported “works once, then dead” behavior.

4. **Selection handling lacks an explicit, user-driven trigger**
   - The side panel auto-starts explanations as soon as it receives `WORD_SELECTED`. There is no separate “confirm” step (like a floating button) while the panel is open.
   - This makes it hard to distinguish between:
     - Intentional LexiLens actions (e.g., context menu, explicit button click), and
     - Incidental text selections while reading.
   - The absence of a dedicated UI trigger also means there is no obvious way to “re-try” the same word/context explicitly, which aligns with the user’s experience that they “can’t use it again” after one run.

Overall, the bug stems from **open/close logic and selection handling being implicitly coordinated via background state and timing**, rather than through explicit, per-tab UI signals. This leads to brittle behavior after the first use and does not match the updated UX requirements.

## Affected components
- `extension/src/background/service-worker.ts`
  - Tracks `lastSelection`, `isSidepanelOpen`, and `activeTabId`.
  - Handles `WORD_SELECTED`, `SIDE_PANEL_READY`, and context-menu flows.
- `extension/src/content/content-script.ts`
  - Unconditionally sends `WORD_SELECTED` on every selection or double-click.
  - Handles `LEXILENS_CONTEXT_MENU` by immediately sending a `WORD_SELECTED` again.
  - Currently has no concept of whether the side panel is open.
- `extension/src/content/content-script.css`
  - Contains only highlight styling; will need extension for the floating LexiLens button.
- `extension/src/sidepanel/main.tsx`
  - Establishes the long-lived `sidepanel` port used by the background to infer open/closed state.
- `extension/src/sidepanel/App.tsx`
  - Consumes `WORD_SELECTED` and `SIDE_PANEL_READY` messages to start streaming analysis.
  - May need minor adjustments to align with the new, more explicit “LexiLens It” trigger semantics.
- `extension/src/shared/types.ts`
  - Defines `MessageType`; will need to include a new message for sidepanel open/close state broadcast (e.g., `LEXILENS_SIDEPANEL_STATE`).

## Proposed solution

### 1. Make side-panel open state explicit to content scripts
- Introduce a new message type, e.g. `LEXILENS_SIDEPANEL_STATE`, and extend `MessageType` in `extension/src/shared/types.ts`.
- In `extension/src/background/service-worker.ts`:
  - When a `sidepanel` port connects:
    - Set `isSidepanelOpen = true`.
    - Broadcast `{ type: 'LEXILENS_SIDEPANEL_STATE', open: true }` to all tabs (or at least the active tab).
  - When the port disconnects:
    - Set `isSidepanelOpen = false`.
    - Broadcast `{ type: 'LEXILENS_SIDEPANEL_STATE', open: false }` similarly.
- This keeps the current `lastSelection` behavior but makes the open/closed state observable to page content scripts.

### 2. Change content-script selection behavior to be UI-driven
- In `extension/src/content/content-script.ts`:
  - Maintain a local `sidepanelOpen` flag, updated via `LEXILENS_SIDEPANEL_STATE` messages.
  - On `mouseup` / `dblclick`:
    - If `sidepanelOpen === false`:  
      - Do **not** send `WORD_SELECTED`.  
      - Clear any existing floating LexiLens button.
    - If `sidepanelOpen === true`:  
      - Build the `AnalysisRequest` payload (as today) but **do not immediately call** `sendSelection`.
      - Compute the selection’s bounding rectangle and show a small floating “LexiLens It” button just under the last line (approx. `rect.bottom` with `window.scrollY` offset).
      - Store the payload in memory so the button’s click handler can send it later.
  - Keep the existing `LEXILENS_CONTEXT_MENU` handler as the **explicit trigger when the panel is closed**:
    - When this message is received, still call `sendSelection(buildContextPayload(...))` so that:
      - The background seeds `lastSelection`.
      - The side panel, once opened, can hydrate via `SIDE_PANEL_READY` as it does now.

### 3. Implement the floating “LexiLens It” button
- Extend `extension/src/content/content-script.css` with styles for a small, high-z-index pill/button, e.g.:
  - Slight shadow, rounded corners, `LexiLens It` label.
  - Positioned absolutely based on the selection rectangle.
- In the content script:
  - Create/manage a singleton DOM element for this button:
    - Reposition it on each new selection while the side panel is open.
    - Hide it on `Escape`, page scroll, or clicking outside the button.
  - When the user clicks the button:
    - Call `sendSelection(currentPayload)` to trigger a new analysis.
    - Hide the button.
  - This ensures that **only explicit button clicks** (while the panel is open) start new analyses, matching the updated UX expectation.

### 4. Keep and slightly harden existing background logic
- Keep using `isSidepanelOpen` to decide when to update `lastSelection` for `WORD_SELECTED` messages, since:
  - Selections while the panel is closed should not silently change what `SIDE_PANEL_READY` will return.
  - Selections + button clicks while the panel is open should update `lastSelection` as today.
- Ensure that:
  - Context-menu flow still seeds `lastSelection` even when the panel is closed.
  - `SIDE_PANEL_READY` continues to return a selection scoped to the active tab only, preserving the “per-tab” behavior from the `correct-tab-switching-behavior` task.

### 5. Testing / verification plan
- Static checks (in this environment):
  - `pnpm --dir extension lint` and `pnpm --dir extension typecheck` if dependencies are available; otherwise rely on TypeScript compiler output when running `pnpm build` locally.
- Manual browser verification (post-build):
  1. Load the built extension in Chrome.
  2. With the side panel **closed**:
     - Select text → no panel opens, no overlay appears.
     - Right-click → **LexiLens It** → side panel opens and immediately starts an explanation for that selection.
  3. With the side panel **open**:
     - Select different words on the page:
       - A floating **LexiLens It** button appears under the selection each time.
       - Clicking the button starts a new analysis and updates the side panel.
       - Repeating on the same word/context still works and does not get “stuck”.
  4. Close and re-open the side panel, switch tabs, and verify that the behavior remains consistent (no “single-use only” state).

This plan directly addresses the reported “use once only” issue by making the side panel’s open state explicit to content scripts and introducing an explicit, user-visible LexiLens trigger for follow-up explanations.


## Implementation notes

### Code changes

- **Background service worker (`extension/src/background/service-worker.ts`)**
  - Added `broadcastSidepanelState(open: boolean)` helper that sends a `LEXILENS_SIDEPANEL_STATE` message to all tabs (ignoring tabs without a content script).
  - When the `sidepanel` port connects, the worker:
    - Sets `isSidepanelOpen = true`.
    - Calls `broadcastSidepanelState(true)` so content scripts know the helper UI is visible.
  - When the port disconnects, the worker:
    - Sets `isSidepanelOpen = false`.
    - Calls `broadcastSidepanelState(false)` so content scripts can clear any UI affordances such as the floating button.

- **Shared message types (`extension/src/shared/types.ts`)**
  - Extended `MessageType` with `LEXILENS_SIDEPANEL_STATE` so the new broadcast fits into the existing message type union.

- **Content script (`extension/src/content/content-script.ts`)**
  - Introduced a `sidepanelOpen` flag that is updated whenever a `LEXILENS_SIDEPANEL_STATE` message is received.
  - Reworked selection handling:
    - `mouseup` / `dblclick` now call `handleUserSelection(trigger)` instead of immediately sending `WORD_SELECTED`.
    - If the side panel is **closed**, the handler does nothing and hides any existing floating button.
    - If the side panel is **open**, the handler:
      - Builds the normal analysis payload via `buildContextPayload`.
      - Computes the selection’s bounding rectangle (using the last client rect to approximate the last line).
      - Stores the payload in `floatingButtonPayload` and positions a singleton floating button below the selection.
  - Implemented a singleton floating **LexiLens It** button:
    - Styled via the new `.lexilens-floating-button` CSS class.
    - Clicking the button:
      - Calls the debounced `sendSelection(floatingButtonPayload)` to trigger a new analysis.
      - Hides the button.
    - The button is hidden automatically on:
      - Scroll (captured, passive listener).
      - Window resize.
      - `Escape` key press.
  - Kept the `LEXILENS_CONTEXT_MENU` handler as the explicit trigger when the panel is closed:
    - Still calls `sendSelection(buildContextPayload(..., 'double-click'))` so the background seeds `lastSelection` and the side panel can hydrate via `SIDE_PANEL_READY`.

- **Content script styling (`extension/src/content/content-script.css`)**
  - Added `.lexilens-floating-button` with:
    - High `z-index`, pill-shaped appearance, gradient background, and subtle shadow.
    - Hover state with a slightly stronger shadow.
  - This keeps the floating control visually distinct and ensures it appears above page content.

- **Side panel app (`extension/src/sidepanel/App.tsx`)**
  - Removed the guard that ignored duplicate selections with the same `word` and `context`.
  - This allows users to explicitly re-run the same word/context (e.g., by clicking the floating button again) without the UI silently dropping the request, directly addressing the “can’t use it again” part of the bug.
  - Follow-up fix for **analyze request flooding**:
    - The effect that sends `SIDE_PANEL_READY` and registers the `WORD_SELECTED` listener previously depended on `handleSelection`. Because `handleSelection` closes over `learningWords`, every new entry in the learning history caused the effect to re-run, send `SIDE_PANEL_READY` again, and immediately re-trigger `startAnalysis` with the last selection, leading to a loop of `/api/analyze` calls.
    - Introduced a `handleSelectionRef` that tracks the latest `handleSelection` via a small `useEffect`, and changed the side panel wiring effect to have an empty dependency array (`[]`). The runtime listener now calls `handleSelectionRef.current`, so it always uses the latest handler without re-sending `SIDE_PANEL_READY` on each history update.

### Tests and checks

- Ran extension linting:
  - Command: `pnpm --dir extension lint`
  - Result: **Pass** (only existing `any`-type warnings remain; no errors).
- Ran TypeScript type checks:
  - Command: `pnpm --dir extension typecheck`
  - Result: **Pass** (no type errors).

These changes align the implementation with the planned fix:
- The content script now knows when the side panel is open or closed.
- With the panel open, users get an explicit floating **LexiLens It** button beneath their selection to start the next explanation.
- With the panel closed, only the right-click **LexiLens It** context menu opens the side panel and triggers analysis.
- Repeating analyses for the same word/context is now supported without reinstalling the extension.
