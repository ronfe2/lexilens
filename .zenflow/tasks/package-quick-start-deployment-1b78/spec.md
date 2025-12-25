# LexiLens Packaging & Deployment – Technical Specification

## 1. Technical Context

- **Monorepo layout**
  - `backend/`: FastAPI backend using `poetry`, SSE streaming via `sse_starlette`, Pydantic models under `app/models`, orchestration in `app/services`, configuration via `app/config.py` (`Settings` from `pydantic_settings`).
  - `extension/`: Chrome MV3 side-panel extension built with React + TypeScript + Vite + `@crxjs/vite-plugin`.
    - Entry: `src/sidepanel/App.tsx` wired to app store in `src/store/appStore.ts`.
    - Shared types and constants: `src/shared/{types,constants,utils}.ts`.
    - Sidepanel hooks: `src/sidepanel/hooks/*` (streaming, learning history, wordbook, interests, theme, user profile, persistence).
    - Background/service worker and content scripts under `src/background` and `src/content`.
    - Build: `pnpm build` from `extension/` emits extension bundle into repo-root `dist/` via `vite.config.ts` and validates `dist/manifest.json` via `scripts/validate-dist.mjs`.
  - Root docs: `demo-script.md` (guided demo), `report.md` (architecture overview).

- **Backend technical details**
  - FastAPI app defined in `backend/app/main.py`, routers in `backend/app/api/routes/*.py`.
  - Key endpoints:
    - `POST /api/analyze` – SSE streaming of analysis layers.
    - `POST /api/analyze/mistakes` – JSON Layer-3 generation.
    - `POST /api/lexical-map/image` – image generation with in‑memory cache.
    - `POST /api/lexical-map/text` – JSON Layer-4 lexical map text.
    - `POST /api/interests/from-usage` – interest topic summarization.
    - `GET /` and `GET /health` – simple metadata/health checks.
  - Configuration (via environment or `.env`):
    - `OPENROUTER_*` keys for model selection and optional “thinking” modes.
    - `API_HOST`, `API_PORT`, `CORS_ORIGINS`, `LOG_LEVEL`, retry/timeout parameters.

- **Extension technical details**
  - Uses `chrome.storage.local` with `STORAGE_KEYS` from `src/shared/constants.ts` to persist:
    - Learning history (`LEARNING_HISTORY` via `useLearningHistory`).
    - User profile (`USER_PROFILE` via `useUserProfile`).
    - Interests (`INTERESTS` + `INTERESTS_BLOCKLIST` via `useInterests`).
    - Wordbook (`WORDBOOK` via `useWordbook`).
    - Preferences (`PREFERENCES` via `useTheme`).
  - Demo-specific seed data in `src/shared/constants.ts`:
    - `DEMO_LEARNING_HISTORY`, `DEMO_INTERESTS`, `DEMO_WORDBOOK`.
    - Currently always used on first load via `useLearningHistory`, `useInterests`, `useWordbook`.
  - API base URL:
    - `API_URL` constant in `src/shared/constants.ts` uses `import.meta.env.VITE_API_URL || 'http://localhost:8000'`.
    - `.env.example` contains `VITE_API_URL` and `VITE_ENV`.

- **Non-functional**
  - `.gitignore` already excludes `node_modules/`, `dist/`, virtualenvs, `.cache/`, logs, temp files, and common Chrome extension artifacts.
  - Existing test/lint commands:
    - Backend: `poetry run pytest tests/ -v`, `poetry run ruff check app/`.
    - Extension: `pnpm lint`, `pnpm typecheck`, `pnpm build` (implicitly validates bundle via `scripts/validate-dist.mjs`).


## 2. High-Level Implementation Approach

1. **Introduce build-time modes** for the extension (Demo vs Formal) driven by `VITE_APP_MODE`, with a single codebase.
2. **Gate demo-only seeds and behavior** behind a `isDemoMode` flag so Formal builds have no pre-seeded history, interests, or wordbook entries, and no demo backdoors.
3. **Add a demo packaging pipeline**:
   - A root-level bash script (`scripts/package-demo.sh`) that assembles a demo ZIP bundle containing backend + extension source code, demo README, and auxiliary docs, while excluding heavy artifacts.
4. **Add a landing app for the Formal version**:
   - New `landing/` Next.js app (App Router, TypeScript) deployed to Vercel/Render, with:
     - Marketing landing page.
     - Join Waitlist form that forwards to a server-side webhook.
     - Judge entrance route with access-code gate and external download URLs.
5. **Define cloud deployment recipe**:
   - Render deployment for backend (container or Python service).
   - Vercel/Render deployment for landing app, configured to talk to backend API over HTTPS.
6. **Implement new-user onboarding inside the extension**:
   - New onboarding panel and storage-backed completion flag.
   - First-run detection in side-panel app and re-openable “Help / Guide” entry point.
7. **Document screenshots/material hooks**:
   - Demo README sections with “Screenshot placeholder” callouts.
   - Landing/onboarding UI components with dedicated areas for future screenshots/illustrations.


## 3. Build Modes: Demo vs Formal (Extension)

### 3.1 Environment & Config

- Add a new environment variable in `extension/.env.example`:
  - `VITE_APP_MODE=demo` (default for local/demo builds).
- Add a shared config helper, e.g. `extension/src/shared/env.ts`:
  - Reads `import.meta.env.VITE_APP_MODE`.
  - Normalizes to `'demo' | 'production'` with fallback:
    - `'demo'` when unset.
  - Exports booleans:
    - `IS_DEMO_MODE = appMode === 'demo'`.
    - `IS_FORMAL_MODE = appMode === 'production'`.
- Use the same `VITE_API_URL` but document two `.env` variants:
  - `.env.demo`: `VITE_APP_MODE=demo`, `VITE_API_URL=http://localhost:8000`.
  - `.env.formal`: `VITE_APP_MODE=production`, `VITE_API_URL=https://<backend-domain>/`.

### 3.2 Gating Demo-Only Seeds

- **Learning history (`useLearningHistory`)**
  - Current behavior: always seeds `DEMO_LEARNING_HISTORY` on first load if storage is empty or unavailable.
  - New behavior:
    - When `IS_DEMO_MODE`:
      - Preserve current behavior (seed `DEMO_LEARNING_HISTORY`, persist to storage).
    - When `IS_FORMAL_MODE`:
      - Initialize `history` as empty array.
      - If storage contains entries, load them as today.
      - If storage is empty or unavailable, keep history empty instead of seeding demo entries.

- **Interests (`useInterests`)**
  - Current behavior: when `STORAGE_KEYS.INTERESTS` is undefined, seeds `DEMO_INTERESTS` and stores.
  - New behavior:
    - `IS_DEMO_MODE`: keep seeding `DEMO_INTERESTS` on first install; keep current fallback when storage unavailable.
    - `IS_FORMAL_MODE`:
      - Do not seed any demo topics by default.
      - When storage unavailable, fall back to an empty interest list instead of demo topics.

- **Wordbook (`useWordbook`)**
  - Current behavior: populates `DEMO_WORDBOOK` when stored wordbook is empty or storage unavailable.
  - New behavior:
    - `IS_DEMO_MODE`: keep current implemented behavior (demo wordbook for wow effect).
    - `IS_FORMAL_MODE`:
      - Start with an empty wordbook when there are no stored entries.
      - When storage errors occur, keep in-memory state empty.

- **Other demo-focused UX**
  - `CognitiveScaffolding`’s `enableAsyncImageWarmup` prop:
    - Currently wired as `enableAsyncImageWarmup={profile.nickname === 'Lexi Learner'}`.
  - For Formal builds:
    - Keep this behavior (it improves UX without affecting data integrity).
    - If we want stricter parity, we can gate the warmup behind `IS_DEMO_MODE` in a follow-up iteration; this spec treats image warmup as acceptable in both modes.

### 3.3 Build Commands

- Extend `extension/package.json` scripts with mode-aware helpers:
  - `"build:demo": "cross-env VITE_APP_MODE=demo pnpm build"` (or rely on `.env.demo` + `cp`).
  - `"build:formal": "cross-env VITE_APP_MODE=production pnpm build"`.
- For simplicity and minimal dependencies:
  - Primary path: developers set `.env` to the correct env file before running `pnpm build`.
  - `scripts/package-demo.sh` will rely on `VITE_APP_MODE=demo` only for optional build; base demo ZIP does not require a pre-built `dist/` to function.


## 4. Demo Packaging (Local ZIP Bundle)

### 4.1 Target Structure of Demo ZIP

Final archive name: `lexilens-demo-bundle.zip`, containing a single root folder `lexilens-demo/`:

- `lexilens-demo/README.md` – Demo-specific README (see 4.3).
- `lexilens-demo/demo-script.md` – Guided demo flow.
- `lexilens-demo/report.md` – Architecture report (optional but included by default).
- `lexilens-demo/backend/` – full backend source tree:
  - `pyproject.toml`, `poetry.lock`, `app/`, `tests/`, `README.md`, `.env.example`.
- `lexilens-demo/extension/` – full extension source tree:
  - `package.json`, `pnpm-lock.yaml`, `src/`, `public/`, `scripts/`, `vite.config.ts`, `README.md`, `.env.example`, `manifest.json`.

Explicitly excluded from the ZIP (either via `rsync --exclude` or `zip -x`):
- Node artifacts: `node_modules/`, `pnpm-lock store` directories, `.turbo/` (if added later).
- Python artifacts: `.venv/`, `venv/`, `__pycache__/`, `*.pyc`.
- Build outputs: root `dist/`, `extension/dist/`, `backend/build/`, coverage reports, `.cache/`, `.pytest_cache/`.
- Logs and temp files: `*.log`, `tmp/`, `temp/`, `*.tmp`.

### 4.2 `scripts/package-demo.sh`

- Location: new `scripts/` directory at repo root (sibling to `backend/` and `extension/`).
- Responsibilities:
  1. **Clean previous outputs**
     - Ensure an output directory (e.g. `artifacts/demo/`).
     - Remove previous `lexilens-demo-bundle.zip` and staging directory if present.
  2. **Sanity checks**
     - Verify required paths: `backend/`, `extension/`, `demo-script.md`, `report.md` (warn but allow missing report), demo `README.md` source.
     - Optionally assert `zip` is available.
  3. **Stage files**
     - Create `artifacts/demo/lexilens-demo/`.
     - Copy `backend/` and `extension/` using `rsync` (or `cp -R`) with exclusion patterns matched to `.gitignore`.
     - Copy `demo-script.md` and `report.md` into staging root.
     - Copy demo README source (e.g. `docs/README.demo.md`) into staging as `README.md`.
  4. **Package ZIP**
     - From `artifacts/demo/`, run `zip -r ../../lexilens-demo-bundle.zip lexilens-demo/`.
     - Optionally log basic stats (number of files, uncompressed size).
  5. **Exit status**
     - Exit non-zero on missing required inputs or zip failure to make it CI-friendly.

- The script will not run `pnpm install` or `poetry install` by default; the demo README will instruct judges to run these commands after unzipping.

### 4.3 Demo README Content

- Source file (maintainer-edited): `docs/README.demo.md` (new).
- During packaging, this file is copied/renamed to `lexilens-demo/README.md`.
- Structure (aligned with PRD 4.3):
  1. Product Overview (LexiLens summary; screenshot placeholders).
  2. Feature Highlights (reading flow, writing flow, personalization demo).
  3. Architecture Overview (backend + extension + data flow).
  4. Installation & Setup:
     - Backend: Python 3.11+, `poetry install`, `.env` with OpenRouter keys, `poetry run uvicorn app.main:app --reload`.
     - Extension: Node 18+, `pnpm install`, `.env` with `VITE_API_URL`, `pnpm build`, load `dist/` via `chrome://extensions`.
  5. Running the Demo:
     - Quick sanity checks: `poetry run pytest`, `poetry run ruff check app/`, `pnpm lint`, `pnpm typecheck`.
     - Summary of `demo-script.md`.
  6. Troubleshooting (CORS, API URL mismatch, OpenRouter errors, slow responses).
  7. Screenshots (placeholder sections the user can fill with images later).


## 5. Formal Version & Cloud Deployment

### 5.1 Formal Extension Build (No Demo Backdoors)

- Formal build is simply the extension compiled with `VITE_APP_MODE=production` and a cloud API URL.
  - `.env.formal` example:
    ```env
    VITE_API_URL=https://api.lexilens.example.com
    VITE_APP_MODE=production
    VITE_ENV=production
    ```
- Effects in Formal mode:
  - Hooks no longer seed `DEMO_*` data; all personalization grows from real user actions.
  - Existing special-case personalization (e.g., `"strategy" → "tactic"` flow) remains but only triggers based on the user’s genuine history.
  - Any future demo-only shortcuts must be guarded by `IS_DEMO_MODE` from `shared/env.ts`.

### 5.2 Landing App for Formal Version

- New `landing/` directory containing a minimal Next.js 14 App Router app:
  - `landing/package.json` with scripts:
    - `dev`, `build`, `start`, `lint`.
  - `landing/next.config.mjs` – standard config with `output: 'standalone'` for deployment if needed.
  - `landing/app/layout.tsx` – shared layout, font, global styling.
  - `landing/app/page.tsx` – marketing landing page.
  - `landing/app/judge/page.tsx` – judge entrance.
  - `landing/app/api/waitlist/route.ts` – POST handler for Join Waitlist.
  - `landing/app/api/judge-login/route.ts` – POST handler for judge access code verification.
  - `landing/styles/globals.css` – Tailwind or simple CSS depending on styling choice.

- Environment variables (for landing app):
  - `NEXT_PUBLIC_BACKEND_API_URL` – URL of deployed FastAPI backend (for future interactive demos; not strictly required for marketing page).
  - `WAITLIST_WEBHOOK_URL` – optional outgoing webhook endpoint (Zapier, Make, Google Sheets App Script, etc.) for waitlist capture.
  - `JUDGE_ACCESS_CODE` – secret code for judge entrance.
  - `FORMAL_PACKAGE_URL` – public URL of the formal package ZIP (or multiple URLs: `FORMAL_BACKEND_PACKAGE_URL`, `FORMAL_EXTENSION_PACKAGE_URL` if needed).

#### 5.2.1 Landing Page (`/`)

- Components/sections:
  - **Hero section**: product name, one-line pitch, primary CTA (“Join Waitlist” scrolls to waitlist section).
  - **Feature overview**: bullets describing reading coach, writing coach, personalization; screenshot placeholders.
  - **How it works**: numbered steps (install extension → select text → see layered coaching).
  - **Join Waitlist** form:
    - Email field, inline validation, submit button, success/error states.
    - On submit:
      - Calls `POST /api/waitlist` with `{ email, source: 'landing' }`.
      - Disables button and shows a spinner while pending.
  - **Hackathon judge entrance CTA**:
    - Small but visible link, e.g. “好未来 Hackathon 评委入口”, linking to `/judge`.

#### 5.2.2 Waitlist API (`POST /api/waitlist`)

- Route: `landing/app/api/waitlist/route.ts`.
- Request body:
  ```ts
  interface WaitlistPayload {
    email: string;
    source?: 'landing' | 'judge' | 'other';
  }
  ```
- Behavior:
  - Validate email with basic format check and length limits.
  - Optionally deduplicate by email in-memory per cold start (idempotency at best-effort level).
  - If `WAITLIST_WEBHOOK_URL` is set:
    - `fetch(WAITLIST_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, source, ts: new Date().toISOString() }) })`.
    - Ignore non-2xx responses but log to server console.
  - Always respond with:
    - `201` + `{ ok: true }` on successful local validation (even if webhook fails).
    - `400` + `{ ok: false, error: 'invalid_email' }` on validation failure.

### 5.3 Judge Entrance

- Route: `landing/app/judge/page.tsx`.
- UX:
  - Brief copy explaining it is a judge-only area.
  - Single password-style input for access code and submit button.
  - On success:
    - Display instructions to download and install the Formal version package.
    - Show links sourced from `FORMAL_PACKAGE_URL` (or separate env vars for backend/extension).
    - Optionally show links to `report.md`, demo script, and other docs (hosted via static URLs).
  - On failure:
    - Display a generic error message without revealing hints about valid code or code length.

- Security model:
  - Access code is **not** embedded client-side.
  - Judge page client calls `POST /api/judge-login`:
    - Request: `{ code: string }`.
    - Handler (server-side) compares against `process.env.JUDGE_ACCESS_CODE`.
    - Response:
      - `200` + `{ ok: true }` on match.
      - `401` + `{ ok: false }` on mismatch.
  - The judge page uses the returned flag to conditionally render download section.
  - For hackathon purposes, no persistent session/cookie is required; a simple in-memory success state per page load is enough.

### 5.4 Backend Cloud Deployment

- Recommended target: **Render** (web service) for the FastAPI backend.

- Deployment artefacts:
  - Option A (simpler): Document manual setup using Render UI:
    - Root directory: `backend/`.
    - Build command: `poetry install`.
    - Start command: `poetry run uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
  - Option B (more reproducible): Add `render.yaml` at repo root:
    ```yaml
    services:
      - type: web
        name: lexilens-backend
        env: python
        buildCommand: cd backend && poetry install
        startCommand: cd backend && poetry run uvicorn app.main:app --host 0.0.0.0 --port $PORT
        envVars:
          - key: OPENROUTER_API_KEY
            sync: false
          - key: OPENROUTER_MODEL_ID
            sync: false
          - key: API_HOST
            value: 0.0.0.0
          - key: API_PORT
            value: 8000
          - key: CORS_ORIGINS
            value: '["chrome-extension://*", "https://<landing-domain>"]'
    ```

- Post-deploy:
  - Confirm `/health` and `/` endpoints respond over HTTPS.
  - Set `VITE_API_URL` for the Formal extension build to this Render URL.
  - Landings page can optionally call a simple health endpoint to show a “Backend online” indicator in judge area.


## 6. New-User Onboarding (Formal Extension)

### 6.1 Storage & State

- Extend `STORAGE_KEYS` in `extension/src/shared/constants.ts` with:
  - `ONBOARDING = 'lexilens_onboarding'`.
- Define a type in `src/shared/types.ts`:
  ```ts
  export interface OnboardingState {
    completed: boolean;
    completedAt?: number;
    // Optional: which version of the onboarding flow was completed.
    version?: number;
  }
  ```
- New hook `useOnboarding` in `extension/src/sidepanel/hooks/useOnboarding.ts`:
  - Returns:
    - `shouldShowOnboarding: boolean` – whether the panel should auto-open.
    - `markCompleted(): void` – sets `completed=true` and persists to storage.
    - `reset(): void` – clears state (for debugging or future “replay tour” features).
  - Logic:
    - On mount, read `STORAGE_KEYS.ONBOARDING` from `chrome.storage.local`.
    - If absent or invalid, treat as `completed=false`.
    - Only automatically show onboarding when:
      - `IS_FORMAL_MODE` (Formal build).
      - Storage indicates `completed=false`.

### 6.2 UI Composition

- New component `OnboardingPanel` (e.g., `src/sidepanel/OnboardingPanel.tsx`):
  - Multi-step panel or rich single-page panel that:
    - Introduces the LexiLens coach vs dictionary concept.
    - Shows how to trigger the coach (select word, floating button, side-panel entry).
    - Explains the four layers in brief with minimal copy and screenshot placeholders.
    - Provides quick troubleshooting tips (backend connectivity, keys).
  - Actions:
    - “Get Started” / “Finish tour” button that calls `markCompleted` and returns user to main coach view.
    - “Skip for now” that also marks as completed (but we can store a different internal flag if needed).

- Integration into `App.tsx`:
  - Extend `view` state union type to include `'onboarding'`.
  - On initial render (after theme + user profile + hooks are ready), if `IS_FORMAL_MODE && shouldShowOnboarding`, set `view='onboarding'`.
  - Allow user to revisit onboarding via:
    - A “Help / Guide” link or button in `UserProfileCard` (e.g., `onOpenGuide` callback).
    - When clicked, set `view='onboarding'` without toggling completion flag (or optionally reset it).

- Demo builds:
  - Onboarding is still available (via Help link) but does **not** auto-open.
  - `useOnboarding` can short-circuit `shouldShowOnboarding=false` when `IS_DEMO_MODE`.


## 7. Data Model, API & Interface Changes

### 7.1 Extension Types & Constants

- `src/shared/constants.ts`:
  - Add `ONBOARDING` to `STORAGE_KEYS`.
  - Add `APP_MODE_DEFAULT = 'demo'` and possibly export allowed modes for validation.

- `src/shared/types.ts`:
  - Add `OnboardingState` as described above.

- Hooks:
  - `useLearningHistory`, `useInterests`, `useWordbook`:
    - Add `IS_DEMO_MODE` conditionals from `shared/env.ts`.
  - `useOnboarding`:
    - New interface and state machine for onboarding flow.

### 7.2 Landing APIs

- `POST /api/waitlist`:
  - Request/response contracts as in 5.2.2; types defined in `landing/app/api/waitlist/route.ts` or `landing/lib/types.ts`.

- `POST /api/judge-login`:
  - Request: `{ code: string }`.
  - Response:
    - Success: `{ ok: true }` with 200.
    - Failure: `{ ok: false }` with 401.

### 7.3 Configuration Summary

- **Backend**
  - Existing env vars remain; add documentation emphasising:
    - `CORS_ORIGINS` must include:
      - `chrome-extension://<extension-id>` (once assigned).
      - Landing app origin (e.g., `https://lexilens.vercel.app`).

- **Extension**
  - `.env.demo` and `.env.formal` patterns with `VITE_API_URL`, `VITE_APP_MODE`, `VITE_ENV`.

- **Landing**
  - `WAITLIST_WEBHOOK_URL`, `JUDGE_ACCESS_CODE`, `FORMAL_PACKAGE_URL`, `NEXT_PUBLIC_BACKEND_API_URL`.


## 8. Delivery Phases & Verification

### Phase 1 – Build Modes & Demo Packaging

- Implement `shared/env.ts` and gate demo seeds in hooks.
- Add `.env.demo` / `.env.formal` templates.
- Implement `scripts/package-demo.sh` and `docs/README.demo.md`.
- Verification:
  - Extension:
    - `pnpm lint`, `pnpm typecheck`, `pnpm build` from `extension/`.
    - Manual: in a new Chrome profile, load demo build and confirm seeded history, interests, wordbook appear; in a Formal build, confirm they are empty on first run.
  - Backend:
    - `poetry run pytest tests/ -v`, `poetry run ruff check app/`.
  - Packaging:
    - Run `scripts/package-demo.sh`; unzip bundle; confirm excluded folders (no `node_modules/`, `dist/`, `.venv/`), and both backend + extension README files and `.env.example` exist.

### Phase 2 – Landing App & Judge Entrance

- Scaffold `landing/` Next.js app and core pages.
- Implement waitlist API with webhook fan-out.
- Implement judge entrance with server-side access-code validation and environment-configured download URLs.
- Verification:
  - Local: `cd landing && pnpm lint && pnpm build`.
  - Deployed:
    - Verify landing page loads over HTTPS.
    - Submit waitlist form with valid/invalid emails and observe correct responses.
    - Attempt judge entrance with wrong and correct codes; confirm unauthorised attempts do not expose urls; authorised flow shows instructions and download links.

### Phase 3 – New-User Onboarding

- Implement `useOnboarding` hook and `OnboardingPanel` component.
- Wire onboarding into `App.tsx` with view switching and Help/Guide entry point.
- Verification:
  - In Formal build with a fresh Chrome profile, open side panel:
    - Onboarding appears automatically once extension connects.
    - Completing the tour hides it; subsequent opens go directly to coach view.
  - Help link re-opens onboarding.
  - In Demo build, onboarding does not auto-open.

### Phase 4 – Docs & Polish

- Finalise Demo README content and ensure it’s in sync with actual commands and environment variables.
- Add a short `docs/DEPLOYMENT.md` summarising:
  - Render backend deployment.
  - Vercel/Render landing deployment.
  - How to run `scripts/package-demo.sh` and (future) `scripts/package-formal.sh`.
- Capture or specify screenshot requirements for:
  - Demo README.
  - Landing hero & feature sections.
  - Onboarding panel in the extension.

