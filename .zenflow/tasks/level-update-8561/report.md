# Level Update

- Removed the `KET` English level from the type, allowed values, and configuration, defaulting invalid stored values back to `B2`.
- Extended `EnglishLevelConfig` with a `badgeClassName` so each level has a consistent, theme-based color and applied it in the level selector dialog, profile card, profile page, and the "解读" section.
- Updated the "解读" description (CoachSummary) to drop the long English ability text and instead show only the colored level badge.
- When the user changes their level from the side panel, if there is an existing explanation (current selection or saved entry), the extension now immediately re-runs the analysis for that same word with the new level.
- Ran `pnpm install`, `pnpm run typecheck`, and `pnpm run lint` under `extension/`; typecheck passes and eslint reports only pre-existing `any` warnings.
