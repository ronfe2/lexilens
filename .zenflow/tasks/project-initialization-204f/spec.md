# LexiLens - Technical Specification

**Version:** 1.0  
**Date:** 2025-12-17  
**Complexity Assessment:** **HARD**

## Difficulty Rationale

This project is classified as **hard** due to:
- Multi-component architecture (Chrome extension + backend API + AI integration)
- Real-time streaming AI responses requiring WebSocket or SSE implementation
- Complex UI/UX with animations and progressive loading
- Chrome Extension Manifest V3 requirements and security constraints
- State management across content scripts, background service workers, and sidepanel
- OpenRouter API integration with proper error handling and rate limiting
- Production-ready demo requiring polished user experience

---

## 1. Product Vision & Enhancements

### Core Value Proposition
**"Your real-time language coach that transforms passive vocabulary into active mastery"**

LexiLens provides a **lens** through which learners can see not just what words mean, but how they live and breathe in real contexts. Unlike traditional dictionaries that provide answers, LexiLens provides coaching.

### Enhancements for "Magic & Futuristic Feel"

#### 1.1 Streaming AI Responses
- **Real-time content generation**: Show AI analysis as it streams in, not after completion
- **Progressive enhancement**: Display instant basic info (word, pronunciation) immediately, then enhance with AI layers
- **Visual feedback**: Animated loading states that show "thinking" process

#### 1.2 Intelligent Context Awareness
- **Auto-detect reading context**: Identify if user is reading news, academic paper, social media, or email
- **Context-aware coaching**: Adjust tone and examples based on what they're reading
- **Smart highlighting**: Subtly highlight related words on the page after analysis

#### 1.3 Visual Language Mapping
- **Interactive word relationship graph**: For "Cognitive Scaffolding" layer, show visual network of related words
- **Usage timeline**: Show how word usage has evolved over time (formal → casual)
- **Difficulty indicator**: Visual badge showing word complexity level (B2, C1, etc.)

#### 1.4 Immersive UI/UX
- **Glassmorphism design**: Modern frosted glass sidebar with smooth animations
- **Micro-interactions**: Delightful hover effects, smooth transitions, haptic-like feedback
- **Mini AI coach avatar**: Animated assistant icon that provides tips and encouragement
- **Dark mode support**: Automatic theme adaptation

#### 1.5 Enhanced Learning Features
- **Pronunciation**: Audio playback with IPA notation
- **Spaced repetition hints**: Gentle reminders about previously learned words
- **Writing assistant mode**: When detecting writing context, provide proactive suggestions
- **One-click practice**: Generate fill-in-the-blank exercises on the spot

---

## 2. Technical Architecture

### 2.1 System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Chrome Browser                           │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Web Page (any site)                                   │ │
│  │  ┌──────────────────────────────────────┐             │ │
│  │  │  Content Script                       │             │ │
│  │  │  - Selection detection                │             │ │
│  │  │  - Context extraction                 │             │ │
│  │  │  - Page analysis                      │             │ │
│  │  └──────────────────────────────────────┘             │ │
│  └─────────────────┬────────────────────────────────────── │
│                    │ postMessage                            │
│  ┌─────────────────▼────────────────────────────────────┐ │
│  │  Background Service Worker                           │ │
│  │  - Message routing                                    │ │
│  │  - API communication                                  │ │
│  │  - State management                                   │ │
│  └─────────────────┬────────────────────────────────────┘ │
│                    │ Chrome APIs                            │
│  ┌─────────────────▼────────────────────────────────────┐ │
│  │  Side Panel UI (React)                               │ │
│  │  ┌────────────────────────────────────────────────┐  │ │
│  │  │  Header (Word + Quick Info)                    │  │ │
│  │  ├────────────────────────────────────────────────┤  │ │
│  │  │  Layer 1: Behavior Pattern (Streaming)        │  │ │
│  │  ├────────────────────────────────────────────────┤  │ │
│  │  │  Layer 2: Live Contexts (3 Cards)             │  │ │
│  │  ├────────────────────────────────────────────────┤  │ │
│  │  │  Layer 3: Common Mistakes (Error/Correct)     │  │ │
│  │  ├────────────────────────────────────────────────┤  │ │
│  │  │  Layer 4: Cognitive Scaffolding (Graph View)  │  │ │
│  │  └────────────────────────────────────────────────┘  │ │
│  └──────────────────────────────────────────────────────┘ │
└─────────────────────┬────────────────────────────────────────┘
                      │ HTTPS/SSE
┌─────────────────────▼────────────────────────────────────────┐
│  FastAPI Backend Server                                       │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  REST API Endpoints                                    │  │
│  │  - POST /api/analyze (with SSE streaming)              │  │
│  │  - GET /api/pronunciation/{word}                       │  │
│  │  - POST /api/learning-history                          │  │
│  └────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  AI Orchestration Layer                                │  │
│  │  - Parallel LLM calls for 4 layers                     │  │
│  │  - Response streaming                                  │  │
│  │  - Caching & rate limiting                             │  │
│  └────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  OpenRouter Integration                                │  │
│  │  - API key management                                  │  │
│  │  - Model selection                                     │  │
│  │  - Error handling & fallbacks                          │  │
│  └────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
```

### 2.2 Technology Stack

#### Frontend (Chrome Extension)
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite with @crxjs/vite-plugin for HMR support
- **Styling**: Tailwind CSS + Framer Motion for animations
- **State Management**: Zustand (lightweight, perfect for extension)
- **Extension API**: Chrome Extension Manifest V3
- **Communication**: Chrome Runtime Messaging API + EventSource for SSE

#### Backend (API Server)
- **Framework**: FastAPI (Python 3.11+)
- **Async Runtime**: asyncio with uvicorn
- **AI Integration**: httpx for OpenRouter API calls
- **Streaming**: Server-Sent Events (SSE) via sse-starlette
- **Caching**: Redis (optional for production, in-memory for MVP)
- **Configuration**: pydantic-settings for environment management

#### AI/LLM
- **Provider**: OpenRouter
- **Models**: User-configurable (e.g., anthropic/claude-3.5-sonnet, openai/gpt-4-turbo)
- **Fallback Strategy**: Retry with exponential backoff, fallback to simpler model on errors

#### Development Tools
- **Package Manager**: pnpm (frontend), poetry (backend)
- **Linting**: ESLint + Prettier (frontend), ruff + black (backend)
- **Type Checking**: TypeScript (frontend), mypy (backend)
- **Testing**: Vitest (frontend), pytest (backend)

---

## 3. Implementation Approach

### 3.1 Chrome Extension Architecture

#### Manifest V3 Structure
```
extension/
├── manifest.json              # Extension configuration
├── src/
│   ├── background/
│   │   └── service-worker.ts  # Background service worker
│   ├── content/
│   │   ├── content-script.ts  # Injected into web pages
│   │   └── content-script.css # Minimal styles for highlights
│   ├── sidepanel/
│   │   ├── index.html         # Side panel entry
│   │   ├── App.tsx            # Main React app
│   │   ├── components/
│   │   │   ├── Header.tsx
│   │   │   ├── BehaviorPattern.tsx
│   │   │   ├── LiveContexts.tsx
│   │   │   ├── CommonMistakes.tsx
│   │   │   └── CognitiveScaffolding.tsx
│   │   ├── hooks/
│   │   │   ├── useStreamingAnalysis.ts
│   │   │   └── useLearningHistory.ts
│   │   └── store/
│   │       └── appStore.ts    # Zustand store
│   ├── shared/
│   │   ├── types.ts           # Shared TypeScript interfaces
│   │   ├── constants.ts
│   │   └── utils.ts
│   └── assets/
│       ├── icons/
│       └── sounds/
├── public/
│   └── icon-*.png
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.js
```

#### Key Extension Components

**Content Script** (`content-script.ts`):
- Listen for double-click and text selection events
- Extract selected word/phrase and surrounding context (full sentence, paragraph)
- Detect page type (news site, academic, social media) using URL patterns and DOM analysis
- Send message to background worker with: `{ word, context, pageType, url }`

**Background Service Worker** (`service-worker.ts`):
- Receive messages from content script
- Forward API requests to backend server
- Manage extension state and storage
- Handle side panel opening/closing
- Store learning history in chrome.storage.local

**Side Panel UI** (`App.tsx`):
- Render 4-layer analysis interface
- Handle streaming data from backend via SSE
- Manage UI state (loading, error, success)
- Implement smooth animations with Framer Motion
- Support dark/light theme

### 3.2 Backend API Architecture

#### FastAPI Application Structure
```
backend/
├── app/
│   ├── main.py                # FastAPI application entry
│   ├── config.py              # Settings (OpenRouter key, model ID)
│   ├── api/
│   │   ├── routes/
│   │   │   ├── analyze.py     # Main analysis endpoint
│   │   │   ├── pronunciation.py
│   │   │   └── history.py
│   │   └── dependencies.py    # Shared dependencies
│   ├── services/
│   │   ├── openrouter.py      # OpenRouter client
│   │   ├── llm_orchestrator.py # Coordinates 4-layer generation
│   │   ├── prompt_builder.py   # Constructs prompts for each layer
│   │   └── cache_service.py    # Optional caching
│   ├── models/
│   │   ├── request.py         # Pydantic request models
│   │   └── response.py        # Pydantic response models
│   └── utils/
│       ├── streaming.py       # SSE helpers
│       └── error_handling.py
├── tests/
│   ├── test_analyze.py
│   └── test_openrouter.py
├── .env.example
├── pyproject.toml
├── poetry.lock
└── README.md
```

#### API Endpoints

**POST /api/analyze**
```typescript
Request Body:
{
  word: string;           // Selected word/phrase
  context: string;        // Full sentence containing the word
  pageType?: string;      // 'news' | 'academic' | 'social' | 'email'
  learningHistory?: string[]; // Previously looked-up words
}

Response: SSE Stream
event: layer1
data: {"content": "When someone describes a situation as precarious..."}

event: layer2
data: {"contexts": [{source: "twitter", text: "..."}, ...]}

event: layer3
data: {"mistakes": [{wrong: "...", why: "...", correct: "..."}, ...]}

event: layer4
data: {"relatedWords": [{word: "...", difference: "...", whenToUse: "..."}, ...], "personalized": "..."}

event: done
data: {}
```

**GET /api/pronunciation/{word}**
```typescript
Response:
{
  word: string;
  ipa: string;
  audioUrl: string; // Can use external API or generate
}
```

### 3.3 AI Prompt Engineering

#### Layer 1: Behavior Pattern (Cobuild Style)
```python
PROMPT_LAYER1 = """You are a lexicographer in the style of John Sinclair's Cobuild dictionary.

Task: Define the word "{word}" using a complete, self-contained sentence that:
1. Explains its core function and grammatical behavior
2. Describes typical contexts where it's used
3. NEVER uses the word "{word}" itself in the definition
4. Acts as a perfect example sentence

Word: {word}
Context sentence: {context}

Provide ONLY the definition sentence, nothing else."""
```

#### Layer 2: Live Contexts
```python
PROMPT_LAYER2 = """You are a language coach creating realistic, current examples.

Task: Generate 3 distinct, authentic example sentences for "{word}", each from a different source:

1. **Twitter/Social Media**: Casual, conversational tone (max 280 chars)
2. **News (BBC/NYT style)**: Formal, objective, journalistic
3. **Academic/Professional**: Precise, technical, sophisticated

Requirements:
- Each example must feel natural and current (2024-2025)
- Include enough context to understand the situation
- Use the word "{word}" naturally, not forced
- Mark which source each is from

Word: {word}
Original context: {context}

Return as JSON:
[
  {{"source": "twitter", "text": "..."}},
  {{"source": "news", "text": "..."}},
  {{"source": "academic", "text": "..."}}
]"""
```

#### Layer 3: Common Mistakes
```python
PROMPT_LAYER3 = """You are an experienced ESL teacher identifying common errors.

Task: Identify the 2 most common mistakes non-native speakers make with "{word}".

For each mistake:
1. ❌ **Wrong**: [incorrect example sentence]
2. **Why it's wrong**: [brief explanation]
3. ✅ **Correct**: [corrected version]

Word: {word}
Context: {context}

Be concise and practical."""
```

#### Layer 4: Cognitive Scaffolding
```python
PROMPT_LAYER4 = """You are a vocabulary coach building connections.

Task: Recommend 2 related words/phrases that help learners understand "{word}" better.

For each related word:
- **Word**: [related word]
- **Relationship**: [synonym/antonym/narrower/broader term]
- **Key Difference**: [how it differs from "{word}"]
- **When to Use Each**: [usage guidance]

{personalization}

Word: {word}
Context: {context}

Keep it concise and actionable."""

# Personalization injection (for demo)
if "strategy" in learningHistory and word == "tactic":
    personalization = """
IMPORTANT: The user previously learned "strategy". Start your response with:
"💡 You learned 'strategy' before! Let me show you how 'tactic' relates to it..."
"""
```

### 3.4 Streaming Implementation

**Backend (FastAPI)**:
```python
from sse_starlette.sse import EventSourceResponse

async def analyze_stream(request: AnalyzeRequest):
    async def event_generator():
        # Layer 1
        async for chunk in openrouter_client.stream(PROMPT_LAYER1):
            yield {
                "event": "layer1",
                "data": json.dumps({"content": chunk})
            }
        
        # Layers 2, 3, 4 in parallel
        tasks = [
            generate_layer2(request),
            generate_layer3(request),
            generate_layer4(request),
        ]
        results = await asyncio.gather(*tasks)
        
        for layer_num, result in enumerate(results, start=2):
            yield {
                "event": f"layer{layer_num}",
                "data": json.dumps(result)
            }
        
        yield {"event": "done", "data": "{}"}
    
    return EventSourceResponse(event_generator())
```

**Frontend (React Hook)**:
```typescript
function useStreamingAnalysis(word: string, context: string) {
  const [layers, setLayers] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const eventSource = new EventSource(
      `${API_URL}/api/analyze?word=${word}&context=${context}`
    );

    eventSource.addEventListener('layer1', (e) => {
      const data = JSON.parse(e.data);
      setLayers(prev => ({ ...prev, layer1: data }));
    });

    // ... similar for layer2, layer3, layer4

    eventSource.addEventListener('done', () => {
      eventSource.close();
      setIsLoading(false);
    });

    return () => eventSource.close();
  }, [word, context]);

  return { layers, isLoading };
}
```

---

## 4. Data Models & Interfaces

### 4.1 TypeScript Interfaces (Frontend)

```typescript
// shared/types.ts

export interface AnalysisRequest {
  word: string;
  context: string;
  pageType?: 'news' | 'academic' | 'social' | 'email' | 'other';
  learningHistory?: string[];
  url?: string;
}

export interface BehaviorPattern {
  definition: string;
  generatedAt: number;
}

export interface LiveContext {
  source: 'twitter' | 'news' | 'academic';
  text: string;
  highlightedWord: string;
}

export interface CommonMistake {
  wrong: string;
  why: string;
  correct: string;
}

export interface RelatedWord {
  word: string;
  relationship: 'synonym' | 'antonym' | 'broader' | 'narrower';
  keyDifference: string;
  whenToUse: string;
}

export interface CognitiveScaffolding {
  relatedWords: RelatedWord[];
  personalizedTip?: string;
}

export interface AnalysisResult {
  word: string;
  pronunciation?: {
    ipa: string;
    audioUrl?: string;
  };
  layer1?: BehaviorPattern;
  layer2?: LiveContext[];
  layer3?: CommonMistake[];
  layer4?: CognitiveScaffolding;
}

export interface LearningHistoryEntry {
  word: string;
  timestamp: number;
  context: string;
}
```

### 4.2 Python Models (Backend)

```python
# app/models/request.py
from pydantic import BaseModel, Field
from typing import Optional, List, Literal

class AnalyzeRequest(BaseModel):
    word: str = Field(..., min_length=1, max_length=100)
    context: str = Field(..., min_length=1, max_length=5000)
    page_type: Optional[Literal['news', 'academic', 'social', 'email', 'other']] = None
    learning_history: Optional[List[str]] = None
    url: Optional[str] = None

# app/models/response.py
class LiveContext(BaseModel):
    source: Literal['twitter', 'news', 'academic']
    text: str

class CommonMistake(BaseModel):
    wrong: str
    why: str
    correct: str

class RelatedWord(BaseModel):
    word: str
    relationship: Literal['synonym', 'antonym', 'broader', 'narrower']
    key_difference: str
    when_to_use: str

class CognitiveScaffolding(BaseModel):
    related_words: List[RelatedWord]
    personalized_tip: Optional[str] = None
```

---

## 5. File Structure & Changes

### 5.1 New Files to Create

#### Chrome Extension
```
extension/
├── manifest.json
├── src/
│   ├── background/service-worker.ts
│   ├── content/content-script.ts
│   ├── content/content-script.css
│   ├── sidepanel/index.html
│   ├── sidepanel/App.tsx
│   ├── sidepanel/components/Header.tsx
│   ├── sidepanel/components/BehaviorPattern.tsx
│   ├── sidepanel/components/LiveContexts.tsx
│   ├── sidepanel/components/CommonMistakes.tsx
│   ├── sidepanel/components/CognitiveScaffolding.tsx
│   ├── sidepanel/components/LoadingSpinner.tsx
│   ├── sidepanel/hooks/useStreamingAnalysis.ts
│   ├── sidepanel/hooks/useLearningHistory.ts
│   ├── sidepanel/store/appStore.ts
│   ├── sidepanel/styles/global.css
│   ├── shared/types.ts
│   ├── shared/constants.ts
│   └── shared/utils.ts
├── public/icon-16.png
├── public/icon-48.png
├── public/icon-128.png
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
└── .env.example
```

#### Backend
```
backend/
├── app/
│   ├── main.py
│   ├── config.py
│   ├── api/
│   │   ├── routes/analyze.py
│   │   ├── routes/pronunciation.py
│   │   └── routes/history.py
│   ├── services/
│   │   ├── openrouter.py
│   │   ├── llm_orchestrator.py
│   │   ├── prompt_builder.py
│   │   └── cache_service.py
│   ├── models/
│   │   ├── request.py
│   │   └── response.py
│   └── utils/
│       ├── streaming.py
│       └── error_handling.py
├── tests/
│   ├── test_analyze.py
│   └── test_openrouter.py
├── .env.example
├── .gitignore
├── pyproject.toml
└── README.md
```

#### Project Root
```
/
├── extension/          # Chrome extension code
├── backend/           # FastAPI backend
├── .gitignore         # Git ignore patterns
└── README.md          # Project documentation
```

### 5.2 Configuration Files

**extension/.env.example**:
```env
VITE_API_URL=http://localhost:8000
VITE_ENV=development
```

**backend/.env.example**:
```env
OPENROUTER_API_KEY=your_key_here
OPENROUTER_MODEL_ID=anthropic/claude-3.5-sonnet
API_HOST=0.0.0.0
API_PORT=8000
CORS_ORIGINS=["chrome-extension://*"]
LOG_LEVEL=INFO
```

**extension/manifest.json** (key sections):
```json
{
  "manifest_version": 3,
  "name": "LexiLens",
  "version": "1.0.0",
  "description": "Your real-time language coach embedded in your browser",
  "permissions": [
    "activeTab",
    "sidePanel",
    "storage"
  ],
  "host_permissions": [
    "http://localhost:8000/*"
  ],
  "background": {
    "service_worker": "src/background/service-worker.ts",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["src/content/content-script.ts"],
      "css": ["src/content/content-script.css"]
    }
  ],
  "side_panel": {
    "default_path": "src/sidepanel/index.html"
  },
  "action": {
    "default_title": "Open LexiLens"
  }
}
```

---

## 6. Enhanced Features Implementation

### 6.1 Intelligent Context Detection

```typescript
// content-script.ts
function detectPageType(): string {
  const url = window.location.href;
  const domain = window.location.hostname;
  
  // News sites
  if (/economist|nytimes|bbc|reuters|guardian/.test(domain)) {
    return 'news';
  }
  
  // Academic
  if (/scholar\.google|arxiv|researchgate|jstor/.test(domain)) {
    return 'academic';
  }
  
  // Social media
  if (/twitter|facebook|linkedin|reddit/.test(domain)) {
    return 'social';
  }
  
  // Email
  if (/mail\.google|outlook/.test(domain)) {
    return 'email';
  }
  
  return 'other';
}
```

### 6.2 Visual Word Relationship Graph

Using D3.js or a simpler library like vis-network for Layer 4:

```typescript
// CognitiveScaffolding.tsx
import { Network } from 'vis-network';

function WordRelationshipGraph({ word, relatedWords }) {
  useEffect(() => {
    const nodes = [
      { id: 0, label: word, color: '#3B82F6', size: 30 },
      ...relatedWords.map((rw, i) => ({
        id: i + 1,
        label: rw.word,
        color: '#10B981',
        size: 20
      }))
    ];
    
    const edges = relatedWords.map((rw, i) => ({
      from: 0,
      to: i + 1,
      label: rw.relationship
    }));
    
    const network = new Network(containerRef.current, { nodes, edges }, options);
  }, [word, relatedWords]);
  
  return <div ref={containerRef} className="h-64" />;
}
```

### 6.3 Pronunciation Integration

```python
# backend/app/api/routes/pronunciation.py
from fastapi import APIRouter
import httpx

router = APIRouter()

@router.get("/pronunciation/{word}")
async def get_pronunciation(word: str):
    # Use Free Dictionary API
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"https://api.dictionaryapi.dev/api/v2/entries/en/{word}"
        )
        if response.status_code == 200:
            data = response.json()[0]
            phonetic = data.get('phonetic', '')
            audio = next(
                (p['audio'] for p in data.get('phonetics', []) if p.get('audio')),
                None
            )
            return {
                "word": word,
                "ipa": phonetic,
                "audioUrl": audio
            }
    
    return {"word": word, "ipa": "", "audioUrl": None}
```

---

## 7. Verification Approach

### 7.1 Development Testing

#### Backend Tests
```bash
# Run unit tests
poetry run pytest tests/ -v

# Test coverage
poetry run pytest --cov=app tests/

# Lint and type check
poetry run ruff check app/
poetry run mypy app/
```

#### Frontend Tests
```bash
# Run unit tests
pnpm test

# Type checking
pnpm tsc --noEmit

# Lint
pnpm eslint src/
```

### 7.2 Integration Testing

**Test Scenarios**:
1. **Word Selection Flow**: Double-click word → side panel opens → all 4 layers load
2. **Phrase Selection**: Select multi-word phrase → correct analysis
3. **Context Detection**: Test on different site types (news, academic, social)
4. **Streaming**: Verify layers appear progressively, not all at once
5. **Error Handling**: Test with invalid words, API failures, network errors
6. **Learning History**: Query word A, then word B → personalized tip appears
7. **Performance**: Analyze response time (target: <3s for all layers)

### 7.3 Manual Testing Checklist

- [ ] Extension installs without errors in Chrome
- [ ] Side panel opens smoothly on word selection
- [ ] All 4 layers render correctly with sample words
- [ ] Animations are smooth (60fps)
- [ ] Dark mode works properly
- [ ] Audio pronunciation plays correctly
- [ ] Mobile/responsive design (if applicable)
- [ ] Error states show helpful messages
- [ ] Learning history persists across sessions
- [ ] Demo flow works end-to-end for presentation

### 7.4 Performance Benchmarks

**Targets**:
- Time to first layer: <500ms
- All 4 layers complete: <3s
- Side panel animation: <200ms
- Memory usage: <50MB for extension
- API response size: <50KB per analysis

---

## 8. Deployment & Demo Setup

### 8.1 Backend Deployment

**Development**:
```bash
cd backend
poetry install
poetry run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Production (for demo)**:
- Deploy to cloud provider (Railway, Render, or DigitalOcean)
- Or use ngrok for local tunneling:
  ```bash
  ngrok http 8000
  ```

### 8.2 Extension Loading

**Development Mode**:
1. Build extension: `pnpm build`
2. Open Chrome → `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select `extension/dist` folder

**Demo Package**:
- Create ZIP of built extension
- Share with judges for easy installation

### 8.3 Demo Data Preparation

**Hardcoded Learning History** (for personalized demo):
```typescript
// sidepanel/store/appStore.ts
const DEMO_LEARNING_HISTORY = [
  'strategy',
  'implement',
  'comprehensive'
];

// Use this when user queries 'tactic' to trigger personalized response
```

**Demo Script Preparation**:
1. Pre-load NY Times article with target words
2. Pre-select demonstration words: `precarious`, `synergy`, `tactic`
3. Prepare Google Docs with sentence to demonstrate writing mode
4. Test full flow 3+ times before presentation

---

## 9. Risk Mitigation

### 9.1 Technical Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| OpenRouter API rate limits | High | Implement caching, request queuing, fallback responses |
| Streaming not supported by browser | Medium | Graceful fallback to regular JSON responses |
| Chrome extension approval issues | Low | Manifest V3 compliance, no eval() or external scripts |
| AI hallucinations/incorrect info | Medium | Add disclaimer, validate responses with simple heuristics |
| Performance issues on complex pages | Medium | Debounce selection events, limit context length |

### 9.2 Demo Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Live internet connection fails | High | Pre-cache demo responses, have offline mode |
| API goes down during demo | Critical | Prepare video backup of working demo |
| Extension crashes in front of judges | High | Test extensively, have backup Chrome profile |
| Words not working as expected | Medium | Have 5+ tested words ready, avoid new ones |

---

## 10. Success Metrics

### 10.1 Technical Metrics
- ✅ Extension loads without errors
- ✅ All 4 layers render correctly
- ✅ Response time <3s
- ✅ No console errors during demo
- ✅ Smooth animations (no jank)

### 10.2 Demo Metrics
- ✅ "Wow" moment when streaming appears
- ✅ Judges understand the coaching vs. dictionary distinction
- ✅ Personalized response triggers successfully
- ✅ Visual polish impresses (glassmorphism, animations)
- ✅ Clear product value articulated

---

## 11. Timeline Breakdown (for Hackathon)

**Phase 1: Foundation (4 hours)**
- Setup project structure (frontend + backend)
- Implement basic Chrome extension (content script, background worker, side panel)
- Create basic FastAPI server with OpenRouter integration
- Test end-to-end communication

**Phase 2: Core Features (6 hours)**
- Implement 4-layer prompt engineering
- Build streaming SSE endpoint
- Create React components for each layer
- Implement basic styling with Tailwind

**Phase 3: Polish (4 hours)**
- Add animations with Framer Motion
- Implement glassmorphism design
- Add pronunciation feature
- Create word relationship visualization
- Implement hardcoded personalization

**Phase 4: Testing & Demo Prep (2 hours)**
- End-to-end testing
- Demo script preparation
- Bug fixes
- Performance optimization

**Buffer: 2 hours** for unexpected issues

---

## 12. Open Questions for User

Before implementation, please clarify:

1. **OpenRouter Configuration**:
   - What is your OpenRouter API key?
   - Which model ID should we use (e.g., `anthropic/claude-3.5-sonnet`, `openai/gpt-4-turbo`)?
   - Any rate limits or budget constraints we should be aware of?

2. **Deployment Preferences**:
   - Do you have a preferred cloud provider for the backend?
   - Or should we use ngrok for local development during the hackathon?

3. **Demo Environment**:
   - What type of article/website should we prepare for the demo?
   - Any specific words you want to showcase?
   - Target demo length (5 min, 10 min)?

4. **Additional Features**:
   - Should we include any Chinese language support (translations, explanations in Chinese)?
   - Any other "wow factor" features you have in mind?

---

## Conclusion

This specification provides a comprehensive blueprint for building LexiLens - a next-generation AI language coach that transforms passive vocabulary learning into active mastery. The architecture prioritizes:

1. **Magic & Futurism**: Streaming AI, beautiful animations, intelligent context awareness
2. **Practicality**: Embedded in reading/writing flow, actionable coaching, real-world examples
3. **Product Clarity**: Clear value proposition as a "coach not a dictionary"
4. **LexiLens Alignment**: Visual word relationships, lens metaphor, clarity-focused design

The technical approach balances ambition with feasibility for a hackathon MVP, while maintaining production-quality architecture for future scaling.
