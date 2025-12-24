Prompt Split task implementation
================================

- Added `backend/app/prompt_config.py` as a single configuration module listing all LLM
  prompts (layer1–4 word analysis, interest summarization, lexical map image), with
  inline comments documenting where each prompt is used and what template variables
  are available.
- Refactored `backend/app/services/prompt_builder.py` so all four layers now read their
  system prompts, user prompt templates, and CEFR level notes from `PROMPT_CONFIG`
  instead of hard-coded strings.
- Updated `backend/app/services/llm_orchestrator.py` to use `PROMPT_CONFIG` for the
  interest-topic summarization system/user prompts.
- Updated `backend/app/api/routes/lexical_map.py` so the image-generation prompt is
  also sourced from `PROMPT_CONFIG`.
- Ran `pytest` in `backend/`; all existing tests pass (`9 passed`).

Now all prompts that drive the project are centralized in one config file with
comment-style explanations, making it easier to review, update, and optimize them.

