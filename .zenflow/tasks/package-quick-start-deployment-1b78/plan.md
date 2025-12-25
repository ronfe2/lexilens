# Full SDD workflow

## Configuration
- **Artifacts Path**: {@artifacts_path} → `.zenflow/tasks/{task_id}`

---

## Workflow Steps

### [x] Step: Requirements
<!-- chat-id: c7454b0c-635a-47c4-a4e8-bab21ee220d8 -->

Create a Product Requirements Document (PRD) based on the feature description.

1. Review existing codebase to understand current architecture and patterns
2. Analyze the feature definition and identify unclear aspects
3. Ask the user for clarifications on aspects that significantly impact scope or user experience
4. Make reasonable decisions for minor details based on context and conventions
5. If user can't clarify, make a decision, state the assumption, and continue

Save the PRD to `{@artifacts_path}/requirements.md`.

### [x] Step: Technical Specification
<!-- chat-id: 62a2848a-bb6f-46e5-b449-536d81434cc3 -->

Create a technical specification based on the PRD in `{@artifacts_path}/requirements.md`.

1. Review existing codebase architecture and identify reusable components
2. Define the implementation approach

Save to `{@artifacts_path}/spec.md` with:
- Technical context (language, dependencies)
- Implementation approach referencing existing code patterns
- Source code structure changes
- Data model / API / interface changes
- Delivery phases (incremental, testable milestones)
- Verification approach using project lint/test commands

### [x] Step: Planning
<!-- chat-id: 2e238183-11cd-4027-a762-bd335832b08d -->

Create a detailed implementation plan based on `{@artifacts_path}/spec.md`.

1. Break down the work into concrete tasks
2. Each task should reference relevant contracts and include verification steps
3. Replace the Implementation step below with the planned tasks

Rule of thumb for step size: each step should represent a coherent unit of work (e.g., implement a component, add an API endpoint, write tests for a module). Avoid steps that are too granular (single function) or too broad (entire feature).

If the feature is trivial and doesn't warrant full specification, update this workflow to remove unnecessary steps and explain the reasoning to the user.

Save to `{@artifacts_path}/plan.md`.

### [x] Step: Phase 1 – Build Modes & Demo Packaging
<!-- chat-id: f33ed723-d0c2-4da9-85b8-9c1f6824f34b -->

Implement extension build modes (Demo vs Formal), gate demo-only behavior, and add the demo packaging pipeline and README.

Tasks:
1. Extension build modes & env helper
   - Add `VITE_APP_MODE` to `extension/.env.example` and create `.env.demo` / `.env.formal` templates (see spec §3.1, §3.3).
   - Implement `extension/src/shared/env.ts` to expose `IS_DEMO_MODE` / `IS_FORMAL_MODE` helpers and validate mode strings.
   - Update any existing uses of `import.meta.env.VITE_API_URL` / `VITE_ENV` to go through the shared env helper where appropriate.
   - Verification:
     - From `extension/`, run `pnpm lint` and `pnpm typecheck` to ensure the new helper and env typings are correct.

2. Gate demo-only seeds and behavior
   - Update `useLearningHistory`, `useInterests`, and `useWordbook` hooks to:
     - Use `DEMO_*` seed data only when `IS_DEMO_MODE` is true.
     - Start from empty state in Formal mode (no pre-seeded history/wordbook/interests) as described in spec §3.2.
   - Confirm any other demo-only shortcuts or backdoors are guarded by `IS_DEMO_MODE`.
   - Verification:
     - In Demo mode (`VITE_APP_MODE=demo`), build and load the extension and confirm seeded content still appears.
     - In Formal mode (`VITE_APP_MODE=production`), confirm first-run state has no seeded demo content.

3. Mode-aware build scripts
   - Update `extension/package.json` scripts to add `build:demo` and `build:formal` commands (per spec §3.3).
   - Ensure `pnpm build:demo` / `pnpm build:formal` set the correct env vars (or rely on `.env.demo` / `.env.formal`).
   - Verification:
     - From `extension/`, run `pnpm build:demo` and `pnpm build:formal`; both should succeed and emit `dist/` with the expected manifest.

4. Demo README source
   - Create `docs/README.demo.md` at repo root with the structure defined in spec §4.3 (overview, highlights, architecture, install, running the demo, troubleshooting, screenshot placeholders).
   - Ensure instructions reflect current backend/extension commands (poetry, pnpm, `.env` keys) and mention required Python/Node versions.
   - Verification:
     - Manually review the README for consistency with actual scripts and env vars.

5. Demo packaging script
   - Add `scripts/package-demo.sh` (per spec §4.2, §4.4) that:
     - Cleans any previous `lexilens-demo-bundle.zip` and staging directory under e.g. `artifacts/demo/`.
     - Verifies required inputs: `backend/`, `extension/`, `demo-script.md`, `docs/README.demo.md`, and (optionally) `report.md`.
     - Copies backend and extension trees into `artifacts/demo/lexilens-demo/` using `rsync` or `cp -R` while excluding `node_modules/`, `dist/`, `.venv/`, `__pycache__/`, `*.pyc`, `.cache/`, logs, and temp files (aligned with `.gitignore` and spec §4.1).
     - Copies `demo-script.md`, `report.md` (if present), and `docs/README.demo.md` (renamed to `README.md`) into the staging root.
     - Produces `lexilens-demo-bundle.zip` at repo root or under `artifacts/`.
   - Ensure the script is POSIX-compatible and has executable permissions.
   - Verification:
     - From repo root, run `scripts/package-demo.sh`.
     - Unzip the resulting `lexilens-demo-bundle.zip` into a temp directory and confirm:
       - Structure matches `lexilens-demo/` layout in spec §4.1.
       - No heavy artifacts (`node_modules/`, `dist/`, `.venv/`, caches) are present.
       - Backend and extension trees include their READMEs and `.env.example` files.

### [x] Step: Phase 2 – Landing App & Judge Entrance
<!-- chat-id: ad2f665b-cfc8-4077-b1f5-150f05e2db2e -->

Create the formal landing app, waitlist API, judge entrance flow, and document cloud deployment.

Tasks:
1. Scaffold `landing/` Next.js app
   - Create `landing/` with Next.js App Router, TypeScript, and basic scripts (`dev`, `build`, `start`, `lint`) as per spec §5.2.
   - Add `landing/next.config.mjs` with `output: 'standalone'` (or equivalent) for flexible deployment.
   - Add `landing/app/layout.tsx`, `landing/app/page.tsx`, and `landing/styles/globals.css` with minimal styling and placeholder copy for hero/feature sections.
   - Verification:
     - From `landing/`, run `pnpm lint` and `pnpm build` to ensure the app compiles.

2. Implement Join Waitlist flow
   - Add a waitlist section to `landing/app/page.tsx` with an email input, validation, submit button, and success/error states (per spec §5.2.1).
   - Implement `landing/app/api/waitlist/route.ts`:
     - Accepts `{ email, source }`, validates email, and (if `WAITLIST_WEBHOOK_URL` is set) forwards to the configured webhook as in spec §5.2.2.
     - Returns `201 { ok: true }` on success, `400 { ok: false, error: 'invalid_email' }` on invalid email.
   - Wire the form to call this API and handle responses.
   - Verification:
     - In local dev, submit valid and invalid emails and confirm appropriate responses and UI messages.

3. Implement judge entrance page and API
   - Create `landing/app/judge/page.tsx` with:
     - Copy explaining the judge-only area.
     - A password-style input and submit button.
     - Logic to call `landing/app/api/judge-login/route.ts` with `{ code }`.
   - Implement `landing/app/api/judge-login/route.ts`:
     - Compares the submitted code against `process.env.JUDGE_ACCESS_CODE`.
     - Returns `200 { ok: true }` on match, `401 { ok: false }` otherwise, as in spec §5.3.
   - On success, render download/instruction panel using URLs from `process.env.FORMAL_PACKAGE_URL` (or separate env vars if added).
   - Verification:
     - In local dev, test wrong vs correct access codes and confirm that only successful attempts reveal download info.

4. Deployment documentation & configs
   - Add minimal deployment docs (or a dedicated `docs/DEPLOYMENT.md`) covering:
     - Backend deployment to Render using either UI steps or `render.yaml` as outlined in spec §5.4 and §6.1.
     - Landing app deployment to Vercel or Render, including required env vars (`WAITLIST_WEBHOOK_URL`, `JUDGE_ACCESS_CODE`, `FORMAL_PACKAGE_URL`, `NEXT_PUBLIC_BACKEND_API_URL`) per spec §5.2.2 and §7.3.
   - If using `render.yaml`, add it at repo root as in spec §5.4.
   - Verification:
     - Ensure docs are internally consistent and that commands/env vars match the actual code.

### [x] Step: Phase 3 – New-User Onboarding (Formal Extension)
<!-- chat-id: b37ee96e-ca03-4dcf-aab3-c972fc9ffe78 -->

Add a new-user onboarding experience to the extension and integrate it into the Formal build.

Tasks:
1. Onboarding data model and storage
   - Extend `extension/src/shared/constants.ts` to add an `ONBOARDING` storage key and any additional mode constants needed (spec §7.1).
   - Extend `extension/src/shared/types.ts` with an `OnboardingState` type (e.g., `status: 'not_started' | 'in_progress' | 'completed'`, `completedAt?: string`).
   - Implement `useOnboarding` hook (spec §6.2) that:
     - Reads/writes onboarding state from `chrome.storage.local` using `ONBOARDING` and `storageKeyPrefix`.
     - Exposes `state`, `shouldShowOnboarding`, `markCompleted`, and `reset` helpers.
     - Treats storage errors gracefully (log + default state).
   - Verification:
     - Unit-test or manually verify the hook by toggling state and reloading the extension to ensure persistence works.

2. Onboarding UI component
   - Implement `OnboardingPanel` React component under `extension/src/sidepanel/` (or a suitable folder) based on spec §6.2.
   - Include:
     - Explanation of how to trigger LexiLens, meaning of each layer, and basic personalization overview.
     - Clear actions: “Get Started” / “Finish tour” (calls `markCompleted`) and “Skip for now”.
     - Placeholder areas for screenshots/illustrations the user can later fill in.
   - Verification:
     - Render the panel in isolation (e.g., via a temporary route or story if using Storybook) to confirm layout and actions.

3. Integrate onboarding into main app flow
   - Update `extension/src/sidepanel/App.tsx` to:
     - Include `'onboarding'` in its view state.
     - On initial render, when hooks are ready, use `IS_FORMAL_MODE && shouldShowOnboarding` to decide whether to show onboarding automatically (spec §6.2, demo vs formal behavior in §6.2 “Demo builds”).
     - Provide a “Help / Guide” entry point (e.g., in profile/settings UI) that opens the onboarding panel without resetting completion state unless explicitly requested.
   - Ensure Demo builds do not auto-open onboarding but still allow manual access via the Help link.
   - Verification:
     - In a fresh profile with a Formal build, confirm onboarding appears once and then no longer auto-opens after completion.
     - In a Demo build, confirm normal coach UI loads directly and onboarding is accessible only via Help.

### [x] Step: Phase 4 – Docs, Polish & Final Verification
<!-- chat-id: f3ad3b99-07c2-4864-8bae-3ebe507dc18d -->

Align documentation with implementation, capture screenshot placeholders, and perform end-to-end checks.

Tasks:
1. Screenshot & materials checklist
   - From Demo README, landing page, and onboarding UI, enumerate where screenshots or other assets are expected (per task requirement #6 and spec §4.3, §5.2.1, §6.2).
   - Document this list in `docs/MATERIALS.md` or append to `docs/README.demo.md` / `docs/DEPLOYMENT.md` for the user to fill in.
   - Verification:
     - Confirm all “TODO: screenshot” placeholders are traceable and not blocking functionality.

2. Formal installation docs
   - Create or update a `README.formal.md` or section in `docs/DEPLOYMENT.md` focusing on:
     - Installing/running the Formal backend (deployed Render service or local).
     - Installing the Formal extension build (from judge download links) and connecting it to the cloud backend.
     - How onboarding works on first run and how to re-open it.
   - Ensure these docs clearly distinguish Demo vs Formal flows and do not reference demo-only backdoors.
   - Verification:
     - Manual review for clarity and consistency with implemented behavior.

3. Final test & packaging pass
   - Run full verification commands:
     - Backend: `cd backend && poetry run pytest tests/ -v` and `poetry run ruff check app/`.
     - Extension: `cd extension && pnpm lint && pnpm typecheck && pnpm build:demo && pnpm build:formal`.
     - Landing: `cd landing && pnpm lint && pnpm build`.
   - Re-run `scripts/package-demo.sh` and verify the resulting archive as in Phase 1.
   - If a separate formal package script is added later (e.g., `scripts/package-formal.sh`), include it in this pass.
   - Verification:
     - All commands complete successfully and archives look correct on inspection.

### [x] Step: Chinese
<!-- chat-id: e6d3ff06-226b-44df-b197-7b61b0f9cfa8 -->

1. 所有给评委看的内容，包括 README，落地页，各种说明等等，全部使用简体中文
2. 需要在 README 和落地页中加入Team 信息：

TAL AI HACKATHON 参赛作品
团队名称：Bazinga
成员：李想、姬弘飞（外部）

3. 需要整理一个 logo 的替换方案和说明

### [x] Step: Formal CRX Packaging & Judge Download

1. 增加正式版扩展打包脚本 `scripts/package-formal-crx.sh`，基于 `pnpm build:formal` 输出的根目录 `dist/` 生成 `artifacts/formal/lexilens-formal.crx`，并保存对应私钥 `lexilens-formal.pem` 用于保持扩展 ID 稳定。
2. 更新根目录 `.gitignore`，忽略 `*.crx` / `*.pem` 等打包产物，避免误提交。
3. 调整文档：
   - 在 `docs/DEPLOYMENT.md` 中说明使用 `scripts/package-formal-crx.sh` 生成 CRX，并将其公网地址配置到落地页的 `FORMAL_PACKAGE_URL`；
   - 在 `docs/README.formal.md` 中将评委推荐路径改为通过 `/judge` 下载 CRX，并补充 CRX 安装说明，同时保留从 `dist/` 加载解压扩展的备选方案；
   - 在 `docs/MATERIALS.md` 中将评委入口的素材说明从 ZIP 下载改为 CRX 下载。
4. 更新落地页评委入口 `landing/app/judge/page.tsx`，将下载提示与步骤改为：
   - 验证口令后展示「正式版 Chrome 扩展（CRX）下载链接」；
   - 提示在 `chrome://extensions` 开启开发者模式后拖拽 CRX 安装扩展；
   - 引导评委按照 README / `docs/DEPLOYMENT.md` 部署后端并完成体验脚本。

### [x] Step: Switch Formal Package to dist ZIP

1. 新增正式版扩展打包脚本 `scripts/package-formal-zip.sh`，在构建 `pnpm build:formal` 后，将根目录 `dist/` 打成 `artifacts/formal/lexilens-formal-dist.zip`，用于评委下载并以「加载已解压的扩展程序」方式安装。
2. 更新部署与安装文档：
   - 调整 `docs/DEPLOYMENT.md`，将 `FORMAL_PACKAGE_URL` 的含义改为 dist ZIP 下载地址，并以 ZIP + Load unpacked 作为主安装路径，仅在备注中保留 CRX 方案及其可能出现的 `CRX_REQUIRED_PROOF_MISSING` 限制；
   - 调整 `docs/README.formal.md`，将评委推荐路径改为通过 `/judge` 下载 dist ZIP，解压后在 `chrome://extensions` 中加载已解压扩展，并在 Judge Quickstart 中同步更新步骤；
   - 调整 `docs/MATERIALS.md`，将评委入口相关的截图与配置说明从 CRX 下载改为 dist ZIP 下载。
3. 更新落地页：
   - 在 `landing/app/page.tsx` 中，将「如何使用 LexiLens」部分的安装说明改为通过「加载已解压的扩展程序」加载解压后的安装目录；
   - 在 `landing/app/judge/page.tsx` 中，将评委入口的文案和步骤改为下载 dist ZIP、解压得到 `dist/` 目录并使用「加载已解压的扩展程序」完成安装，同时保留后端部署与体验脚本指引不变。
