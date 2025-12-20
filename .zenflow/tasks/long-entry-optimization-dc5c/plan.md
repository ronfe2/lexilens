# Quick change

## Configuration
- **Artifacts Path**: {@artifacts_path} → `.zenflow/tasks/{task_id}`

---

## Agent Instructions

This is a quick change workflow for small or straightforward tasks where all requirements are clear from the task description.

### Your Approach

1. Proceed directly with implementation
2. Make reasonable assumptions when details are unclear
3. Do not ask clarifying questions unless absolutely blocked
4. Focus on getting the task done efficiently

This workflow also works for experiments when the feature is bigger but you don't care about implementation details.

If blocked or uncertain on a critical decision, ask the user for direction.

---

## Workflow Steps

### [x] Step: Implementation
<!-- chat-id: e9427bcb-c7ac-4441-83a3-79134cf8a215 -->

Implement the task directly based on the task description.

1. Make reasonable assumptions for any unclear details
2. Implement the required changes in the codebase
3. Add and run relevant tests and linters if applicable
4. Perform basic manual verification if applicable

Save a brief summary of what was done to `{@artifacts_path}/report.md` if significant changes were made.

### [x] Step: 修复下浮的按钮
<!-- chat-id: 82a96971-5614-4208-84f3-843afcb9511a -->

这次修改导致之前的逻辑被变动了，之前在侧边栏打开的情况下，选中页面的一些文本，在选中下面会浮起一个 LexiLens This 的按钮，现在这个按钮没有了，检查代码，把按钮修复回来
