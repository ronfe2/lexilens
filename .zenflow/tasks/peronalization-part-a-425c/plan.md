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

### [x] Step: Frontend Implementation — Profile & Interests
<!-- chat-id: 75f4da6c-2c5c-406a-93c7-7ae6905227eb -->

Implement the sidepanel UI changes described in `spec.md`:
- Update user profile model and English level selection (modal overlay, level descriptions).
- Add profile icon and profile management view (avatar, nickname, level).
- Implement interest cards and wordbook sections, backed by `chrome.storage.local`.
- Ensure empty states and deletion flows are reflected correctly in the UI.

### [x] Step: Backend Implementation — Interests API & Prompts
<!-- chat-id: 92d55714-67d8-48d1-ac38-1e86127983bd -->

Implement backend support for interest summarization and prompt updates:
- Add `POST /api/interests/from-usage` with request/response models.
- Implement `LLMOrchestrator.summarize_interests_from_usage` and wire the new route.
- Extend `AnalyzeRequest` and `PromptBuilder.build_layer4_prompt` to accept interest metadata and blocklists.
- Update tests (e.g., `test_prompt_builder.py`) to cover the new prompt behavior.

### [x] Step: Integration & Verification
<!-- chat-id: e45ebc92-d4a0-4aa9-a4be-e9d05da8d646 -->

Wire frontend and backend together and verify end‑to‑end behavior:
- From the sidepanel, call the new interests API after analyses and update stored topics.
- Pass interest metadata/blocklists into `/api/analyze` as needed.
- Run frontend lint/typecheck and backend tests.
- Perform manual QA for all flows (level selection, profile management, interests, wordbook, deletion, empty states).

### [x] Step: 难度适配
<!-- chat-id: fab9ab16-54bd-4d12-9255-bdbdbe221db7 -->

现在我调整难度（比如从B2 调整到 A1 后，词条 header 解释、Lexical Map ，以及 Common Mistakes 的内容仍然还是B2 的，难以看出是A1 的简化版。例如

redacted

词条 header 解释：Redacted means information is deliberately removed or hidden in documents, usually to protect private details or sensitive content before sharing them publicly. People often see redacted text as blacked-out sections in official papers when authorities want to share some facts while keeping other parts confidential.

Lexical Map:
cencored
关键区别： 'Censored' often implies suppression for moral, political, or security reasons, while 'redacted' is more neutral and technical, usually for legal or privacy protection.

使用场景： Use 'censored' when discussing media or government restrictions; 'redacted' for legal documents or confidential reports.

disclosed
关键区别： 'Disclosed' means information is revealed openly, the opposite of 'redacted' which means information is hidden or removed.

使用场景： Use 'disclosed' when information is shared transparently; contrast with 'redacted' when parts are intentionally omitted.

Common Mistakes
Wrong

The document was redact by the legal team for privacy reasons.

错误使用了动词形式'redact'的过去分词，正确应为'redacted'（被动语态需要过去分词）

Correct

The document was redacted by the legal team for privacy reasons.

Wrong

Journalists received a completely redacted pizza from the government.

错误搭配名词'pizza'（披萨），'redacted'通常用于修饰文件或信息类名词

Correct

Journalists received a completely redacted report from the government.

上面所有的解释内容（包括 Lexicon Map 的选词），对于 A1 的水平来说都太难了，解决这个问题

### [x] Step: 默认兴趣领域
<!-- chat-id: 5441f411-8090-495a-88a3-127ce28a8f47 -->

现在兴趣领域需要在首次安装时，加一些默认的兴趣领域，比如足球，北京房产，大模型，这个之前曾实现过，但现在似乎没有了
