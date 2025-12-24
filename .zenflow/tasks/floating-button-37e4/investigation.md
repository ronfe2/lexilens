# Investigation: floating button / LexiLens This

## Bug summary
- When the LexiLens side panel is **closed**, selecting text on a page still shows the floating **“LexiLens This”** button near the bottom of the page.
- Expected: the floating button should **only** appear when the side panel is **open**; when the side panel is closed, selecting text should **not** show this button.

## Reproduction (inferred)
1. Install and load the LexiLens extension in Chrome.
2. Ensure the LexiLens side panel is **closed**.
3. On any normal web page, select some text with the mouse.
4. Observe that a floating “LexiLens This” button appears at the bottom/near the selection.
5. Open the LexiLens side panel and select text again; the same button also appears (this part is expected).

## Affected components
- `extension/src/content/content-script.ts`
  - Manages text selection detection and the floating **“LexiLens This”** button (`selectionButton`).
  - Function `showSelectionButtonForCurrentSelection()` controls whether the button is created/updated.
- `extension/src/background/service-worker.ts`
  - Tracks whether the side panel is open via a long‑lived `chrome.runtime.Port` named `'sidepanel'`.
  - Exposes `LEXILENS_IS_SIDEPANEL_OPEN` message handler which reports `isSidepanelOpen`.
- `extension/src/sidepanel/main.tsx`
  - Opens the long‑lived `'sidepanel'` port so the background can update `isSidepanelOpen`.

## Current behavior (from code)
- On `mouseup` or `dblclick` in the page, the content script calls `showSelectionButtonForCurrentSelection()`.
- That function:
  - Reads the current DOM selection and builds a `Range`.
  - Uses `chrome.runtime.sendMessage({ type: 'LEXILENS_IS_SIDEPANEL_OPEN' }, callback)` to ask the background script if the side panel is open.
  - In the callback:
    - If there is **no runtime error** and `response?.isOpen === true`, it calls `createOrUpdateSelectionButton(...)` to show the floating button.
    - If there is **no runtime error** and `response?.isOpen !== true`, it calls `removeSelectionButton()` so the button is hidden.
    - If there **is** a runtime error (for example, background not reachable or no listener), it currently **falls back to showing the button anyway** by calling `createOrUpdateSelectionButton(...)`, except when the error message includes `"Extension context invalidated"`, in which case it silently returns.
  - If `chrome.runtime.sendMessage` itself throws, the `catch` block also **falls back to showing the button** (again, except for the `"Extension context invalidated"` case).
- The background script:
  - Maintains `let isSidepanelOpen = false;`.
  - Sets `isSidepanelOpen = true` on `chrome.runtime.onConnect` for the `'sidepanel'` port, and `false` on `port.onDisconnect`.
  - Answers `LEXILENS_IS_SIDEPANEL_OPEN` messages with `{ success: true, isOpen: isSidepanelOpen }`.
  - Also broadcasts a `LEXILENS_SIDEPANEL_STATE` message to all tabs whenever the panel opens/closes, but the content script **does not currently listen to this broadcast**.

## Root cause analysis (hypothesis)
- The intended behavior (“only show the floating button when the side panel is open”) is implemented **under normal conditions** via the `LEXILENS_IS_SIDEPANEL_OPEN` query.
- However, the content script deliberately **ignores side panel state when messaging fails**:
  - On any `chrome.runtime.lastError` (other than `"Extension context invalidated"`) it **still shows** the floating button.
  - On any thrown error in `sendMessage` (again excluding the invalidated-context case) it also **still shows** the button.
- In environments where:
  - The background worker is not ready yet,
  - The message channel is temporarily unavailable,
  - Or the runtime reports `"Receiving end does not exist"` because the service worker is not listening yet,
  the current code will **treat the state as “unknown” but still show the button**. This contradicts the new product expectation that “when the side panel is closed, the button should not float up at the bottom”.
- Therefore, the effective root cause is:
  > The selection button code treats “cannot determine side panel state” as “go ahead and show the LexiLens button”, instead of defaulting to “hide the button unless we know the panel is open”.

## Proposed solution
- Change the selection‑button gating logic so that the button is shown **only when we positively know** the side panel is open.
- Concretely:
  - In `showSelectionButtonForCurrentSelection()`:
    - If `chrome.runtime.sendMessage` returns a response with `response?.isOpen === true`, show the button.
    - For **all other cases** (no response, `isOpen !== true`, `lastError` set, or any thrown error), **do not show the button** and instead call `removeSelectionButton()`.
  - Optionally, introduce a small local state in the content script:
    - Track `let isSidepanelOpenInTab = false;`.
    - Listen for `LEXILENS_SIDEPANEL_STATE` messages from the background to keep this flag up‑to‑date for the tab.
    - Prefer to use this flag directly when deciding whether to show the button, falling back to the `LEXILENS_IS_SIDEPANEL_OPEN` request only when we have not yet received a broadcast for the current tab.
- This ensures:
  - When the side panel is **open**, the state is known (`isOpen === true`), so the floating “LexiLens This” button appears on selection as desired.
  - When the side panel is **closed** or its state is **unknown** (e.g. messaging failures, background not ready), the safe default is to **hide** the button, matching the product requirement.

## Edge cases to keep in mind
- Extension reloads / “Extension context invalidated”:
  - We should continue to treat this as a hard failure and avoid showing stale UI on the page.
- Tabs without the content script (e.g. `chrome://` pages):
  - Background broadcasts already handle “Receiving end does not exist”; the content script should not assume anything for these tabs.
- Very long pages or selections near viewport edges:
  - Existing positioning logic (based on `Range.getBoundingClientRect()`) remains unchanged; this task focuses only on **when** to show the button, not **where** it appears.
- Future Firefox or non‑Chrome ports:
  - If runtime messaging behaves differently, the “default to hide when state is unknown” rule remains conservative and avoids leaking the LexiLens UI when the side panel is not available.

---

## Implementation notes

- Updated `extension/src/content/content-script.ts`:
  - In `showSelectionButtonForCurrentSelection()`:
    - When `chrome.runtime.lastError` is set (except for `"Extension context invalidated"`), the content script now calls `removeSelectionButton()` instead of `createOrUpdateSelectionButton(...)`.
    - When `chrome.runtime.sendMessage` throws (again, excluding the `"Extension context invalidated"` case), it also calls `removeSelectionButton()` instead of showing the button.
    - The button is now shown *only* when a successful response is received and `response.isOpen === true`; all other conditions default to hiding.
- This aligns behavior with the product requirement: the floating **“LexiLens This”** button appears only when we can positively confirm that the side panel is open; closed or unknown state means **no button**.

## Testing

- Automated checks:
  - `cd extension && pnpm install`
  - `cd extension && pnpm typecheck`
  - `cd extension && pnpm lint` (ESLint completes with existing warnings about `any`, no new issues introduced).
- Manual/behavioral expectations (to verify in browser):
  1. With the side panel **closed**, select text → no floating “LexiLens This” button appears.
  2. Open the side panel, then select text → the floating button appears near the selection.
  3. If the background script is unavailable or messaging fails, the button does **not** appear, preventing it from showing when side panel state is unknown.
