Long Entry Optimization
=======================

- Header headword is now shortened using a shared utility so that very long selections (sentences/paragraphs) do not blow up the side panel height, while keeping the full text in a tooltip.
- The 解读 intro sentence now refers to long selections generically as “这句话” instead of inserting the full text when the selection exceeds a few words.
- Lexical Map nodes now use a concise label derived from each related word (first few words/characters with ellipsis) instead of rendering an entire long sentence.
- Added shared helpers in `extension/src/shared/utils.ts` (`isLongEntry`, `createShortLabel`) to centralize long‑entry heuristics.
- Updated the backend layer‑4 prompt (`backend/app/services/prompt_builder.py`) so the LLM keeps `related_words[*].word` as a short word/phrase (1–3 words) suitable for node labels and never returns full sentences there.
- Introduced a dedicated lexical base word pipeline: `getLexicalBaseWord` on the frontend plus `lexicalBaseWord`/`lexical_base_word` fields so Layer‑4 related nodes and Lexical Map images are generated around the same normalized keyword that the Lexical Map center node displays, instead of the full sentence selection.
- Restored the inline “LexiLens This” floating button under text selections (when the side panel is open) via the content script, so users explicitly trigger explanations without changing the long‑entry behavior.
- Rebased onto the latest `main` (including the open-logic-bug fixes) by merging `main` into this branch and then fast-forwarding `main` to the merged commit.

Checks:
- Ran `pnpm install --frozen-lockfile` in `extension/`.
- Ran `pnpm lint` in `extension/` (only existing `any` warnings remain, no new errors).
- Ran `python -m compileall backend/app` to validate backend syntax.
