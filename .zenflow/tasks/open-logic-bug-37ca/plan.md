# Fix bug

## Configuration
- **Artifacts Path**: {@artifacts_path} → `.zenflow/tasks/{task_id}`

---

## Workflow Steps

### [x] Step: Investigation and Planning
<!-- chat-id: 54d52080-bf06-456c-a2ee-4fe6e0407d20 -->

Analyze the bug report and design a solution.

1. Review the bug description, error messages, and logs
2. Clarify reproduction steps with the user if unclear
3. Check existing tests for clues about expected behavior
4. Locate relevant code sections and identify root cause
5. Propose a fix based on the investigation
6. Consider edge cases and potential side effects

Save findings to `{@artifacts_path}/investigation.md` with:
- Bug summary
- Root cause analysis
- Affected components
- Proposed solution

### [x] Step: Implementation
<!-- chat-id: f1011f9a-805e-4fb2-bef3-5fac9198c55a -->
Read `{@artifacts_path}/investigation.md`
Implement the bug fix.

1. Add/adjust regression test(s) that fail before the fix and pass after
2. Implement the fix
3. Run relevant tests
4. Update `{@artifacts_path}/investigation.md` with implementation notes and test results

If blocked or uncertain, ask the user for direction.

### [x] Step: bug fix: analyze request flooding
<!-- chat-id: fe162c8b-22fb-41b0-aaeb-8fe76b27fc2a -->

现在前端在开始分析后，疯狂发送 analyze 请求，下面是部分服务端日志：

e' with context length: 1161
INFO:     127.0.0.1:52023 - "POST /api/analyze HTTP/1.1" 200 OK
2025-12-20 19:26:39,962 - app.api.routes.analyze - INFO - Analyzing word: 'tranche' with context length: 1161
INFO:     127.0.0.1:52025 - "POST /api/analyze HTTP/1.1" 200 OK
2025-12-20 19:26:40,128 - app.api.routes.analyze - INFO - Analyzing word: 'tranche' with context length: 1161
INFO:     127.0.0.1:52027 - "POST /api/analyze HTTP/1.1" 200 OK
2025-12-20 19:26:40,321 - app.api.routes.analyze - INFO - Analyzing word: 'tranche' with context length: 1161
INFO:     127.0.0.1:52033 - "POST /api/analyze HTTP/1.1" 200 OK
2025-12-20 19:26:40,455 - app.api.routes.analyze - INFO - Analyzing word: 'tranche' with context length: 1161
INFO:     127.0.0.1:52035 - "POST /api/analyze HTTP/1.1" 200 OK
2025-12-20 19:26:40,674 - app.api.routes.analyze - INFO - Analyzing word: 'tranche' with context length: 1161
INFO:     127.0.0.1:52037 - "POST /api/analyze HTTP/1.1" 200 OK
2025-12-20 19:26:40,822 - app.api.routes.analyze - INFO - Analyzing word: 'tranche' with context length: 1161
INFO:     127.0.0.1:52039 - "POST /api/analyze HTTP/1.1" 200 OK

查找并修正这个问题
