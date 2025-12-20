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

export interface WordbookEntry {
  id: string;
  word: string;
  translation?: string;
  example?: string;
  stage: 1 | 2 | 3 | 4 | 5;
  lastReviewedAt?: number;
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
