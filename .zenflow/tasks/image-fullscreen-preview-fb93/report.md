# Image Fullscreen Preview Fix

- Updated `extension/src/background/service-worker.ts` to change how `LEXILENS_SHOW_LEXICAL_IMAGE` messages are handled.
- The background script now forwards the image overlay request to the active tab using the Promise-based `chrome.tabs` APIs and always replies to the side panel once the forwarding attempt completes.
- This ensures the side panel only opens its own image modal when the content script cannot be reached (true failure), avoiding the previous behavior where both the main page and the side panel showed overlays at the same time.
- Rebased `image-fullscreen-preview-fb93` onto the latest `main` so that the fullscreen image behavior coexists with the newer LexiLens floating button / side panel state wiring.
- Ran `pnpm lint` and `pnpm typecheck` in `extension/`; type-checking passes and ESLint reports only existing `any` warnings.
