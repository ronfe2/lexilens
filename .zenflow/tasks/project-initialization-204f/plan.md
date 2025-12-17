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
<!-- chat-id: da704fbd-a482-48a9-a079-e8efe569263a -->

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

### [x] Step: Project Initialization & Setup
<!-- chat-id: a67302a8-adb7-4f11-96fb-5cd626dcfa1f -->

Initialize project structure and configure development environment.

**Tasks**:
- Create root `.gitignore` file
- Initialize backend project structure with FastAPI + Poetry
- Initialize frontend extension project with React + Vite + TypeScript
- Configure Tailwind CSS and development tools
- Create environment configuration files

**Verification**:
- `poetry install` runs successfully in backend/
- `pnpm install` runs successfully in extension/
- Both projects have proper `.gitignore` files

---

### [x] Step: Backend Core Implementation
<!-- chat-id: 599b255c-953d-4daa-acf5-caadd7279134 -->

Build FastAPI backend with OpenRouter integration.

**Tasks**:
- Implement configuration management (`config.py`) for OpenRouter API
- Create OpenRouter client service (`services/openrouter.py`)
- Build prompt engineering templates (`services/prompt_builder.py`)
- Implement LLM orchestrator for 4-layer generation (`services/llm_orchestrator.py`)
- Create Pydantic request/response models
- Add error handling and retry logic

**Verification**:
- Run `poetry run pytest tests/` (if tests created)
- Run `poetry run ruff check app/`
- Manual test: Send request to OpenRouter API and receive response

---

### [x] Step: Backend API Endpoints with SSE Streaming
<!-- chat-id: 2e506159-9f6c-4f36-b035-818953e16b35 -->

Implement REST API endpoints with Server-Sent Events streaming.

**Tasks**:
- Create main FastAPI application (`main.py`)
- Implement `/api/analyze` endpoint with SSE streaming
- Implement `/api/pronunciation/{word}` endpoint
- Add CORS configuration for Chrome extension
- Implement streaming helpers (`utils/streaming.py`)

**Verification**:
- Start server: `poetry run uvicorn app.main:app --reload`
- Test SSE endpoint with curl or browser
- Verify CORS headers allow chrome-extension:// origins

---

### [x] Step: Chrome Extension Foundation
<!-- chat-id: 65452e80-1712-47fc-99a2-911048c99305 -->

Build basic Chrome extension structure with Manifest V3.

**Tasks**:
- Create `manifest.json` with required permissions and configuration
- Implement background service worker (`background/service-worker.ts`)
- Implement content script for text selection (`content/content-script.ts`)
- Set up message passing between content script and background worker
- Create basic side panel HTML structure
- Configure Vite build for Chrome extension

**Verification**:
- Run `pnpm build`
- Load unpacked extension in Chrome
- Verify content script injects on web pages
- Test message passing by logging in console

---

### [x] Step: Side Panel UI Components
<!-- chat-id: a809cf03-4e99-4919-8694-94eaf6aed797 -->

Build React components for 4-layer analysis interface.

**Tasks**:
- Set up React app entry point (`sidepanel/App.tsx`)
- Create Zustand store for state management (`store/appStore.ts`)
- Implement Header component with word display
- Create BehaviorPattern component (Layer 1)
- Create LiveContexts component with 3 cards (Layer 2)
- Create CommonMistakes component with error highlighting (Layer 3)
- Create CognitiveScaffolding component with word graph (Layer 4)
- Add LoadingSpinner and error states

**Verification**:
- Build extension and test with mock data
- Verify all components render correctly
- Check responsive layout and styling

---

### [x] Step: Frontend-Backend Integration

Connect side panel to backend API with streaming support.

**Tasks**:
- Implement `useStreamingAnalysis` hook with EventSource
- Implement `useLearningHistory` hook with chrome.storage API
- Connect components to streaming data
- Handle loading, success, and error states
- Implement context detection in content script
- Pass selected word, context, and page type to backend

**Verification**:
- End-to-end test: Select word on web page → side panel shows analysis
- Verify streaming works (layers appear progressively)
- Test error handling (network failure, API errors)
- Check learning history persists across sessions

---

### [ ] Step: Enhanced Features & Polish

Add animations, pronunciation, and visual enhancements.

**Tasks**:
- Implement Framer Motion animations for side panel and components
- Add glassmorphism styling with Tailwind CSS
- Integrate pronunciation API and audio playback
- Create visual word relationship graph for Layer 4
- Add dark mode support
- Implement intelligent context detection
- Add personalized demo feature (hardcoded for hackathon)

**Verification**:
- Test animations are smooth (no jank)
- Verify pronunciation audio plays
- Check word graph renders correctly
- Test dark mode toggle

---

### [ ] Step: Demo Preparation & Testing

Prepare demo environment and conduct end-to-end testing.

**Tasks**:
- Create demo learning history (hardcoded: 'strategy', 'implement', etc.)
- Test personalization trigger (query 'strategy' then 'tactic')
- Prepare demo websites/articles with target words
- Run full demo flow 3+ times
- Fix any bugs found during testing
- Optimize performance (target: <3s for all layers)
- Create demo script and talking points

**Verification**:
- Complete demo runs without errors
- All 4 layers load correctly for demo words
- Personalized response triggers as expected
- Performance meets targets (<500ms first layer, <3s total)

---

### [ ] Step: Final Report

Document implementation results and prepare deliverables.

**Tasks**:
- Write implementation report to `report.md`
- Document any issues encountered and solutions
- Create setup/installation instructions
- Prepare demo package (ZIP of extension)
- Document OpenRouter configuration requirements

**Verification**:
- Report is complete and accurate
- Installation instructions work on fresh machine
- Demo package is ready for judges
