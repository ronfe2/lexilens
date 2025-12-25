# LexiLens Packaging & Deployment PRD

## 1. Background & Goals

LexiLens is a Chrome side-panel extension backed by a FastAPI service. It turns any word the user selects while reading or writing into an in-context coaching experience with:
- Streaming, multi-layer explanations (behavior pattern, live contexts, common mistakes, lexical map)
- Pronunciation (IPA + audio)
- Lightweight personalization using a learning history (e.g., `strategy → tactic` demo path)

The hackathon MVP already supports a polished demo flow and local development setup (`backend/` + `extension/`). This PRD defines additional requirements to:
- Package the current MVP into a **Demo version** that can be run locally from a single archive, with pre-seeded content and demo backdoors preserved.
- Define a **Formal version** suitable for real users, without demo backdoors or hard-coded demo data.
- Provide a **cloud deployment** flow (Vercel or Render) for a landing page + gated judge entrance + backend.
- Add a **new-user onboarding experience** after installation of the formal version.


## 2. Personas & Scenarios

### 2.1 Personas
- **Hackathon Judge (评委)**
  - Wants to quickly understand the product value and verify the implementation.
  - Needs a frictionless way to run the demo locally (Demo version) or access packaged artifacts via a gated entry (Formal version judge entrance).

- **Prospective Power User / Early Adopter**
  - Discovers LexiLens via the landing page.
  - Wants to know what problem LexiLens solves, see example flows, and join the waitlist.

- **Developer / Technical Reviewer**
  - Needs full source code and clear documentation on how to install, run, and extend the system.

### 2.2 Core Scenarios
1. **Local Demo (Demo Version)**
   - Judge downloads a single ZIP archive.
   - Unzips locally and follows the included `README.md` to:
     - Install backend dependencies and run the API.
     - Install extension dependencies, build the extension, and load it in Chrome.
   - Uses the scripted flow (e.g., `demo-script.md`) with pre-seeded history and demo-optimized behavior to complete a demo in ~10 minutes.

2. **Public Landing + Waitlist (Formal Version)**
   - User visits a hosted landing page (Vercel/Render).
   - Reads a concise product introduction with a few highlighted use cases.
   - Enters email in a **Join Waitlist** form.
   - Receives a confirmation message; data is stored server-side (details in spec).

3. **Judge Entrance (Formal Version)**
   - Hackathon judge visits a dedicated **评委入口** link from the landing page.
   - Enters an access code.
   - On success, sees links or instructions to download the formal LexiLens package and installation instructions.

4. **New User Onboarding (Formal Version)**
   - After installing and enabling LexiLens (and connecting to the backend), the user opens the side panel for the first time.
   - A guided onboarding sequence explains:
     - How to select text / double-click words.
     - The meaning of each layer.
     - Where to find settings and how to troubleshoot.
   - Onboarding can be re-visited or dismissed and should not interfere with normal usage afterwards.


## 3. In-Scope vs Out-of-Scope

### 3.1 In Scope
- Define Demo vs Formal version behavior and packaging.
- Document required changes to code/configuration to support two front-end builds.
- Local demo packaging script and doc for Demo version.
- Landing page and judge entrance UX & functional requirements.
- New-user onboarding UX and functional requirements in the Formal version.
- High-level deployment approach on Vercel or Render, including environment configuration.

### 3.2 Out of Scope
- Major new product features beyond packaging/onboarding (e.g., new layers, new teaching modes).
- Deep analytics stack or growth experiments (simple logging or basic metrics may be added later).
- Multi-language UI beyond basic Chinese/English copy support.


## 4. Demo Version Requirements

### 4.1 Objectives
- Preserve the **current demo behavior** exactly as used in the hackathon, including:
  - Pre-seeded learning history (e.g., `strategy`, `implement`, `comprehensive`).
  - Any existing 'backdoor' or debug capabilities that make the demo easier to drive.
- Provide a **single ZIP archive** that:
  - Contains all required source code (backend + extension + supporting docs).
  - Contains a dedicated, self-contained `README.md` that:
    - Describes the product and core flows.
    - Explains the tech stack.
    - Provides step-by-step installation and run instructions.
    - Includes a short demo script or links to `demo-script.md`.
- Provide a **bash packaging script** that builds this archive reliably.

### 4.2 Contents of the Demo Package
The Demo package ZIP (e.g., `lexilens-demo-bundle.zip`) must include:
- `backend/` source tree, including:
  - `README.md`, `pyproject.toml`, `poetry.lock`, `app/`, `tests/`, `.env.example`.
- `extension/` source tree, including:
  - `README.md`, `manifest.json`, `package.json`, `src/`, `public/`, `vite.config.ts`, `.env.example`.
- Top-level docs:
  - `README.md` (Demo version – see 4.3).
  - `demo-script.md` (or equivalent demo flow).
  - `report.md` as optional deeper implementation reference (nice-to-have; configurable).
- Utility / config files required to run locally (e.g., `.gitignore`, lint configs) as appropriate.

The package **must not** include:
- Developer local environments (`.env` files with real keys, virtualenvs, `node_modules/`, build artifacts like `dist/`, `.cache/`, coverage data, logs, etc.).

### 4.3 Demo README Requirements
Create a Demo-specific `README.md` at the root of the package with the following structure:
1. **Product Overview**
   - What LexiLens is and the core value proposition.
   - Screenshots sections (placeholders) for side panel, layers, and personalization moments.
2. **Feature Highlights**
   - Reading flow (answer vs. coach).
   - Writing flow (fix awkward sentence).
   - Personalization demo (`strategy → tactic`).
3. **Architecture Overview**
   - Backend (FastAPI + OpenRouter).
   - Chrome extension (React + Vite + Tailwind + MV3 side panel).
   - High-level data flow diagram description.
4. **Installation & Setup**
   - Backend setup (Python, poetry, `.env` variables, running uvicorn).
   - Extension setup (Node, pnpm, `.env`, `pnpm build`, load unpacked).
   - Explicit note on local-only use and not sharing keys.
5. **Running the Demo**
   - Sanity checks (tests/lint commands to run once).
   - Step-by-step demo script summary.
6. **Troubleshooting**
   - Common issues (CORS, API URL mismatch, OpenRouter errors, slow responses).
7. **(Optional) Screenshots**
   - Placeholders where maintainers can insert images later.

### 4.4 Demo Packaging Script Requirements
- A single bash script at repo root, e.g., `scripts/package-demo.sh` (final path to be determined in spec).
- When run from project root, the script must:
  1. Clean any previous demo ZIP outputs.
  2. Ensure no heavy artifacts are included (e.g., delete/ignore `node_modules/`, `dist/`, `.venv/`).
  3. Confirm required files exist (backend, extension, demo README, demo script).
  4. Create a ZIP archive with the desired structure under a `dist/` or `artifacts/` folder.
- The script **may** build the extension/backend as part of packaging, but only if `.gitignore` is configured to exclude build outputs and dependencies from VCS.


## 5. Formal Version Requirements

### 5.1 Objectives
- Provide a **clean, production-ready build** without demo-only backdoors and hard-coded demo data.
- Support a **cloud deployment** to Vercel or Render, with:
  - A public landing page.
  - A gated judge entrance.
  - A reachable backend API for the extension.
- Add a **new user onboarding flow** inside the extension after installation.

### 5.2 Differences vs Demo Version
- **No Demo Backdoors**
  - Any front-end 'backdoor' features used for testing or forced scenarios (e.g., forcing specific responses, bypassing error handling, debug UIs) must be disabled or removed in the Formal build.
- **No Pre-seeded Demo History**
  - Replace the hard-coded demo learning history with an empty or minimal neutral default for real users.
  - Personalization should grow naturally from user behavior.
- **Configuration Separation**
  - Introduce an environment flag or build-time mode (e.g., `VITE_APP_MODE=demo|production`) to drive conditional logic for demo vs formal builds.

> Open Question: Precisely which behaviors count as 'backdoor' vs acceptable developer debugging tools? (To be clarified with the team and documented in the spec.)

### 5.3 Landing Page Requirements
- Hosted as a small web app (likely Next.js on Vercel, or similar on Render).
- Must include:
  1. **Hero Section**
     - Product name and one-sentence value proposition.
     - Call-to-action button linking to **Join Waitlist** section.
  2. **Feature Overview**
     - Short explanation of reading/writing coaching flows.
     - Visuals or placeholders for screenshots.
  3. **How It Works**
     - Brief steps: install extension → connect to backend → start coaching.
  4. **Join Waitlist**
     - Email input field + submit button.
     - Form validation and thank-you message on success.
     - Server-side data capture (e.g., storing to a database, spreadsheet, or email provider – details in spec).
  5. **Hackathon Judge Entrance (评委入口)**
     - Prominent but not publicized CTA for judges.

### 5.4 Judge Entrance Requirements
- Accessible via a distinct route (e.g., `/judge` or `/review`), linked as **好未来 Hackathon 评委入口**.
- Page contains:
  - A short explanation of the judge-only area.
  - A single input field for **access code**.
  - Submit button.
- On successful code entry:
  - Display a panel with:
    - Links to download the formal version package(s) (e.g., backend + extension build ZIP, or installer instructions).
    - Clear installation instructions and minimum system requirements.
  - Optionally show links to additional docs (`report.md`, spec, demo script).
- On invalid code:
  - Show a friendly error message without revealing any hints about valid codes.

> Open Question: How is the access code generated/managed (single shared code vs per-judge, rotation needs)? For now, PRD assumes a single shared code configured via environment variable.

### 5.5 Formal Installation & Onboarding Requirements

#### 5.5.1 Installation (Formal Package)
- Provide a separate package / docs focused on **real usage** rather than demo.
- Installation should cover:
  - How to deploy or connect to a managed backend (e.g., Render/AWS/other).
  - How to install the extension from a packaged ZIP or (future) store listing.
- Reuse as much as possible from the demo instructions, but:
  - Remove references to hard-coded demo paths.
  - Emphasize user data and privacy considerations.

#### 5.5.2 New-User Onboarding Flow
- Trigger conditions:
  - First time the side panel app is opened after installation or update to the Formal version.
- Flow requirements:
  - Step or panel explaining:
    1. How to select words and open the coach (double-click / selection).
    2. What each layer represents (behavior pattern, contexts, mistakes, lexical map).
    3. How personalization works at a high level.
  - UI should:
    - Be dismissible at any point.
    - Remember completion state in extension storage (e.g., `chrome.storage.local`) so it does not reappear on every open.
    - Allow re-opening via a 'Help / Guide' link in the UI.
- Optional materials:
  - Placeholder areas in UI where screenshots or simple illustrations could be added later (e.g., mini mock panel images).

> Open Question: Should onboarding be a multi-step carousel, an overlay tooltip tour, or a single rich panel? (To be decided in spec/UX.)


## 6. Deployment Requirements (High-Level)

### 6.1 Backend Deployment
- Provide a recipe for deploying the FastAPI backend on a managed platform (Render recommended, Vercel alternative with serverless considerations).
- Minimum requirements:
  - Environment variables: `OPENROUTER_API_KEY`, `OPENROUTER_MODEL_ID`, `API_HOST`, `API_PORT`, `CORS_ORIGINS`.
  - HTTPS endpoint accessible to the extension; document the URL pattern.
  - CORS configured to allow the landing domain and extension origin(s).

### 6.2 Landing Page & Judge Entrance Deployment (Vercel/Render)
- Single app repo or subdirectory that can be deployed to Vercel or Render.
- Includes:
  - Static pages/components for marketing content.
  - API route/handler for waitlist submissions.
  - Environment configuration for the judge access code and optional storage backends.

### 6.3 Extension Build for Production
- Provide a formal build process that:
  - Uses production environment variables (API URL, app mode).
  - Outputs a folder suitable for manual Chrome load or distribution.
- Document how this build relates to the Demo build (flags, npm scripts).


## 7. Non-Functional Requirements

- **Performance**
  - Extension should maintain current target responsiveness (first layer < ~500 ms, full response < ~3 s under normal conditions), acknowledging dependence on LLM latency.
- **Security & Privacy**
  - No real API keys or secrets in any packaged bundle.
  - Judge access code stored server-side or in environment configuration, not hard-coded in client bundles.
  - Clear documentation that user content is sent to an LLM provider via the backend, with a note to check provider policies.
- **Reliability**
  - Packaging scripts should be idempotent and produce consistent archives.
  - Landing page and backend deployment instructions should be verifiable by running a small health check.
- **Maintainability**
  - Demo vs Formal configuration should be primarily driven by environment variables / build flags, not extensive branching in code.


## 8. Open Questions & Assumptions

### 8.1 Open Questions
- Exact definition and list of 'front-end backdoor' features that must be removed or disabled in the Formal version.
- Preferred deployment target: Vercel vs Render for the landing page and backend (can be mixed: e.g., Vercel for landing, Render for backend).
- Required language(s) for landing page and onboarding (Chinese only, English only, or bilingual).
- Storage mechanism for waitlist emails (e.g., database, Google Sheets, email marketing tool).
- Expected number of judges/users for initial phase (affects resource sizing).

### 8.2 Assumptions
- The existing MVP feature set (extension + backend) is considered stable; changes for this task are mostly around packaging, configuration, and onboarding.
- Hackathon judges are comfortable running local Python and Node environments if clearly documented.
- A single shared access code is sufficient for the hackathon judge entrance.
- Network access to OpenRouter remains a requirement; fully offline operation is not in scope.

