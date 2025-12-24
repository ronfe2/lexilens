# Spec and build

## Configuration
- **Artifacts Path**: {@artifacts_path} → `.zenflow/tasks/{task_id}`

---

## Agent Instructions

Ask the user questions when anything is unclear or needs their input. This includes:
- Ambiguous or incomplete requirements
- Technical decisions that affect architecture or user experience
- Trade-offs that require business context

Do not make assumptions on important decisions — get clarification first.

---

## Workflow Steps

### [x] Step: Technical Specification
<!-- chat-id: 161a84e6-d386-46ba-87c4-aac0cdc8b4df -->

Assess the task's difficulty, as underestimating it leads to poor outcomes.
- easy: Straightforward implementation, trivial bug fix or feature
- medium: Moderate complexity, some edge cases or caveats to consider
- hard: Complex logic, many caveats, architectural considerations, or high-risk changes

Create a technical specification for the task that is appropriate for the complexity level:
- Review the existing codebase architecture and identify reusable components.
- Define the implementation approach based on established patterns in the project.
- Identify all source code files that will be created or modified.
- Define any necessary data model, API, or interface changes.
- Describe verification steps using the project's test and lint commands.

Save the output to `{@artifacts_path}/spec.md` with:
- Technical context (language, dependencies)
- Implementation approach
- Source code structure changes
- Data model / API / interface changes
- Verification approach

If the task is complex enough, create a detailed implementation plan based on `{@artifacts_path}/spec.md`:
- Break down the work into concrete tasks (incrementable, testable milestones)
- Each task should reference relevant contracts and include verification steps
- Replace the Implementation step below with the planned tasks

Rule of thumb for step size: each step should represent a coherent unit of work (e.g., implement a component, add an API endpoint, write tests for a module). Avoid steps that are too granular (single function).

Save to `{@artifacts_path}/plan.md`. If the feature is trivial and doesn't warrant this breakdown, keep the Implementation step below as is.

---

### [x] Step: Wordbook Data Model & Hook Updates
<!-- chat-id: be55a15b-d528-45c5-ae99-3478070f4f8c -->

- Extend `WordbookEntry` and related types in `extension/src/shared/types.ts` to support snapshots, favorites, and timestamps as described in `spec.md`.
- Update `DEMO_WORDBOOK` and wordbook-related constants in `extension/src/shared/constants.ts`.
- Implement the expanded `useWordbook` hook API in `extension/src/sidepanel/hooks/useWordbook.ts`, including sanitization, persistence, `upsertEntryFromAnalysis`, `incrementStageForWord`, `recordLexicalImage`, `toggleFavoriteByWord`, and `deleteEntry`.

### [x] Step: Analysis Persistence & Mastery Logic
<!-- chat-id: 3889aff1-462c-4017-89aa-4eaaebe3ee44 -->

- Implement `useAnalysisPersistence` to connect `useWordbook` and `useAppStore` so completed analyses are persisted as snapshots and mastery is incremented.
- Extend `useStreamingAnalysis` to accept an optional `onAnalysisComplete` callback and invoke it after successful, non-aborted runs.
- Wire the new persistence and mastery callbacks into `App.tsx` for live analyses and Lexical Map views.

### [x] Step: Favorites & Header / Lexical Map Integration
<!-- chat-id: 5b517568-b37f-4d8d-80bb-f7f303caeaca -->

- Extend `Header` props and UI to show favorite state and toggle via the existing bookmark button.
- Use `useWordbook` in `App.tsx` to compute the active word’s favorite status and pass handlers into `Header`.
- Extend `CognitiveScaffolding` to accept `favoriteWords`, `onImageGenerated`, and `onLexicalMapShown`, updating its selection logic to prioritize favorites when choosing the default related node.

### [x] Step: Profile Wordbook Management UI
<!-- chat-id: 8cb049fa-a286-42b2-aea9-465d2aba0fe4 -->

- Update the Profile page wordbook section to:
  - Sort entries by favorite status and reverse addition time.
  - Paginate results with simple previous/next controls.
  - Show favorite indicators, allow toggling favorites, and support deletion with confirmation.
- Implement saved-entry navigation from Profile into a read-only detail view that reuses the coach layout and includes a top “open original link” bar.
- Ensure the active wordbook entry is visually highlighted when returning to the Profile view.

### [x] Step: Backend Favorites Support (Optional but Recommended)
<!-- chat-id: eafaf88a-a62f-477a-a864-fca220210d08 -->

- Extend `AnalyzeRequest` in `backend/app/models/request.py` with an optional `favorite_words` field.
- Update `PROMPT_CONFIG["layer4"]` and `PromptBuilder.build_layer4_prompt` to incorporate favorites into the personalized coaching instructions.
- Pass `favorite_words` through `LLMOrchestrator` into the layer4 prompt, and validate that existing tests still pass.

### [x] Step: Verification & Report
<!-- chat-id: f0af5ac4-1cf8-4818-82ab-93388fcfef35 -->

- Run frontend linting, type checking, and build commands; run backend tests as appropriate.
- Manually verify the flows listed in the Verification Plan section of `spec.md` (wordbook creation, favorites, saved-entry view, Lexical Map image persistence, mastery increments, and pagination).
- Write `{@artifacts_path}/report.md` summarizing implementation details, how the solution was tested, and any issues or trade-offs encountered.
