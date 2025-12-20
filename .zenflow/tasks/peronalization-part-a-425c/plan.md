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
<!-- chat-id: 7b83278e-cac5-48af-b3a7-d2724a424953 -->

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

### [ ] Step: Frontend Implementation — Profile & Interests

Implement the sidepanel UI changes described in `spec.md`:
- Update user profile model and English level selection (modal overlay, level descriptions).
- Add profile icon and profile management view (avatar, nickname, level).
- Implement interest cards and wordbook sections, backed by `chrome.storage.local`.
- Ensure empty states and deletion flows are reflected correctly in the UI.

### [ ] Step: Backend Implementation — Interests API & Prompts

Implement backend support for interest summarization and prompt updates:
- Add `POST /api/interests/from-usage` with request/response models.
- Implement `LLMOrchestrator.summarize_interests_from_usage` and wire the new route.
- Extend `AnalyzeRequest` and `PromptBuilder.build_layer4_prompt` to accept interest metadata and blocklists.
- Update tests (e.g., `test_prompt_builder.py`) to cover the new prompt behavior.

### [ ] Step: Integration & Verification

Wire frontend and backend together and verify end‑to‑end behavior:
- From the sidepanel, call the new interests API after analyses and update stored topics.
- Pass interest metadata/blocklists into `/api/analyze` as needed.
- Run frontend lint/typecheck and backend tests.
- Perform manual QA for all flows (level selection, profile management, interests, wordbook, deletion, empty states).
