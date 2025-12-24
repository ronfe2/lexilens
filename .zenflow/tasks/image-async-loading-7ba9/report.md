## Image Async Loading – Implementation Report

- Added async warmup logic for lexical map images in `extension/src/components/CognitiveScaffolding.tsx` so that, for the default demo profile (nickname `Lexi Learner`), a background image request starts as soon as the Lexical Map data arrives.
- Implemented prioritization for the warmup request: prefer `synonym` relationships first, then fall back to alphabetical order among visible related words.
- Ensured that the prefetched image is not shown until the user explicitly clicks the "绘制漫画" button; if the image is ready before the click, a random 1–5 second delay is added after the click to mimic a live request.
- Avoided duplicate backend calls when a warmup request is already in-flight or completed for the same word pair; the visible request reuses the warmup result instead of sending a second request.
- Threaded a new `enableAsyncImageWarmup` prop from `extension/src/sidepanel/App.tsx` into `CognitiveScaffolding`, enabling warmup only when the profile nickname is exactly `Lexi Learner`.
- Ran `pnpm install` in `extension`, then verified the changes with `pnpm typecheck` and `pnpm lint` (warnings only, no new errors).

