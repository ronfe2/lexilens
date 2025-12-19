# Correct tab switching behavior – Implementation Report

## What changed

- Updated `extension/src/background/service-worker.ts` to track the last selection **per tab** instead of globally.
- Introduced a `LastSelectionRecord` that stores both the `AnalysisRequest` and the originating `tabId`.
- When handling `WORD_SELECTED` messages, the background script now records the selection together with `sender.tab.id` (only when the side panel is open).
- When the side panel sends `SIDE_PANEL_READY`, the background script only returns a `selection` if it matches the current tab’s `tabId`; otherwise it returns `null`.
- Context menu flow still seeds `lastSelection`, but it is now scoped to the tab where the context menu was used.

## Behavioral outcome

- Opening the side panel on a **different tab** no longer replays the explanation for a word selected on a previous tab; the UI stays in the empty standby state until a new word is selected.
- Re-opening the side panel on the **same tab** after a recent selection still allows the background script to provide that tab’s last selection (subject to Chrome providing `sender.tab.id`), preserving the existing convenience where possible.

## Verification notes

- Static review of the updated background script confirms:
  - No change to message shapes consumed by the side panel (`selection` remains an `AnalysisRequest | null`).
  - Existing flows (context menu, live `WORD_SELECTED` streaming) remain intact.
- TypeScript / linting commands were not run in this environment because Node dependencies are not installed; changes are localized and type-safe under the existing `AnalysisRequest` typing.

