export interface AnalysisRequest {
  word: string;
  context: string;
  pageType?: 'news' | 'academic' | 'social' | 'email' | 'other';
  learningHistory?: string[];
  // Learner's CEFR level (e.g. "B1") used for level-aware prompts
  englishLevel?: string;
  url?: string;
  // Optional interest metadata used for personalization and summarization
  interests?: InterestTopic[];
  // Titles of interests the user has explicitly removed; used as a blocklist
  blockedTitles?: string[];
  // Words explicitly marked as favorites in the learner's wordbook
  favoriteWords?: string[];
  // Optional list of backend layers (2, 3, 4) to compute; Layer 1 is always streamed.
  // When omitted, the frontend will default to [2,4] so Common Mistakes (Layer 3)
  // can be generated lazily when the user clicks the section.
  layers?: number[];
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
  relationship: 'synonym' | 'antonym' | 'broader' | 'narrower' | 'collocate';
  // When Lexical Map operates in a candidate-first mode, the frontend may
  // temporarily receive related words that only include `word` and
  // `relationship` with details filled in later. Keep these fields optional
  // so the UI can gracefully handle that partial state.
  keyDifference?: string;
  whenToUse?: string;
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

export interface InterestLink {
  url: string;
  title?: string;
  lastUsedAt: number;
}

export interface InterestTopic {
  id: string;
  title: string;
  summary: string;
  links: InterestLink[];
  createdAt: number;
  updatedAt: number;
}

export interface WordbookSnapshot {
  id: string; // unique per snapshot (e.g. timestamp-based)
  createdAt: number;
  request: {
    context: string;
    pageType?: AnalysisRequest['pageType'];
    url?: string;
  };
  analysis: AnalysisResult;
  lexicalImages?: {
    baseWord: string;
    relatedWord: string;
    imageUrl: string;
    prompt?: string;
    createdAt: number;
  }[];
}

export interface WordbookEntry {
  id: string;
  word: string;
  translation?: string;
  example?: string;
  stage: 1 | 2 | 3 | 4 | 5;
  lastReviewedAt?: number;
  isFavorite?: boolean;
  createdAt?: number;
  updatedAt?: number;
  latestSnapshot?: WordbookSnapshot;
  snapshots?: WordbookSnapshot[];
}

export interface OnboardingState {
  completed: boolean;
  completedAt?: number;
  // Optional: which version of the onboarding flow was completed.
  version?: number;
}

export type MessageType =
  | 'WORD_SELECTED'
  | 'OPEN_SIDEPANEL'
  | 'ANALYSIS_COMPLETE'
  | 'SIDE_PANEL_READY'
  | 'LEXILENS_CONTEXT_MENU'
  | 'LEXILENS_SIDEPANEL_STATE';

export interface Message {
  type: MessageType;
  data?: any;
}
