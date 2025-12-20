# Update Info – Implementation Report

## What was implemented

- Added level-aware Cobuild explanation under the headword:
  - Backend `PromptBuilder.build_layer1_prompt` now accepts an optional `english_level` argument and constrains the definition to at most 100 words.
  - `LLMOrchestrator.generate_layer1_stream` forwards `english_level` from the new `AnalyzeRequest.english_level` field.
  - The sidepanel `Header` component now shows a compact context preview (truncated with tooltip) and the streamed Cobuild-style definition under the word, separated by a subtle divider and smaller typography.
- Introduced learner-profile-aware Chinese coach summary as the first explanation card:
  - Created `CoachSummary` component that renders a Chinese-first coaching card using `analysisResult.layer4.personalizedTip`, the current headword, and the user’s CEFR level from `useUserProfile`.
  - Wired `CoachSummary` to appear as the first main section under the header in `App.tsx`.
  - Removed the in-component personalized tip card from `CognitiveScaffolding` so the tip is only shown in the new coach card.
- Simplified the sidepanel structure and ordering:
  - Removed `LiveContexts` from the main flow in `App.tsx` (backend layer2 still streams but is unused in the UI).
  - Reordered sections to: coach summary → Lexical Map (`CognitiveScaffolding`) → Common Mistakes.
  - Stopped rendering the old `BehaviorPattern` card; layer1 is now consumed by the header explanation.
- Added context tracking for better UX:
  - Extended the zustand store (`useAppStore`) with `currentContext` and a `setCurrentContext` action, cleared on reset.
  - `useStreamingAnalysis.startAnalysis` now stores the full request context in the store so the header context preview is always aligned with the latest analysis.
- Wired learner CEFR level end-to-end:
  - Front-end `AnalysisRequest` type gained an optional `englishLevel` field.
  - `App.handleSelection` populates `englishLevel` from `profile.englishLevel`.
  - `useStreamingAnalysis` sends `english_level` in the `/api/analyze` POST body.
  - Backend `AnalyzeRequest` model now includes `english_level`, and the orchestrator passes it into layer1 and layer4 prompt builders.
  - `PromptBuilder.build_layer4_prompt` now accepts `english_level` and uses it to tailor the Chinese personalized coaching instructions.
- Moved theme toggle to the user profile banner and added an “add to word list” stub:
  - `UserProfileCard` now accepts `theme` and `onToggleTheme` props, rendering a Sun/Moon toggle button on the right side of the banner.
  - `App.tsx` passes theme state into `UserProfileCard` instead of `Header`.
  - `Header` replaces the old theme toggle with a `BookmarkPlus` icon labeled “加入生词表（即将上线）”, with a stub click handler (console log) wired from `App.tsx`.
- General UX and UI polish:
  - Kept cards glassy but decluttered: coach summary is a single, compact card with clear Chinese labeling; Lexical Map and Common Mistakes retain existing layouts.
  - Ensured the context preview uses `truncateText` and browser-native tooltip for full text on hover, keeping the header clean and readable.

## How the solution was tested

- Front-end:
  - Ran `pnpm lint` in `extension/` (no errors, existing warnings about `any` types remain).
  - Ran `pnpm typecheck` (TypeScript `--noEmit` passes with the updated props and types).
  - Ran `pnpm build` to confirm the Vite/CRX production build succeeds and the dist manifest validates.
- Backend:
  - Ran `poetry run pytest tests/ -v` in `backend/`; all tests pass, including the extended `test_prompt_builder` coverage for level-aware prompts.
  - Ran `poetry run ruff check app/`; this still reports pre-existing style issues (e.g., suggestions to replace `typing.List` with `list` and to use `X | Y` unions) that were not introduced by this change.
  - Attempted `poetry run mypy app/`; the command failed because `mypy` is not installed in the environment.

## Issues and challenges

- Coordinating prompt changes across the backend and front-end types required careful signature updates (`build_layer1_prompt`, `build_layer4_prompt`, orchestrator methods, and `AnalyzeRequest`) to keep streaming behavior and tests intact.
- Ruff surfaced several legacy style warnings unrelated to this task; addressing them would require broader refactoring of existing modules, so they were left as-is, and only the new long-line issues introduced in `prompt_builder.py` were fixed.
- The environment’s Python tooling uses multiple versions (3.9 vs 3.12) when invoking Poetry commands; tests still run successfully, but this split is worth keeping in mind for future type-checking or tooling setup.

