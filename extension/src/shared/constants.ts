export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const STORAGE_KEYS = {
  LEARNING_HISTORY: 'lexilens_learning_history',
  PREFERENCES: 'lexilens_preferences',
} as const;

export const DEMO_LEARNING_HISTORY = [
  'strategy',
  'implement',
  'comprehensive',
];

export const PAGE_TYPE_PATTERNS = {
  news: /economist|nytimes|bbc|reuters|guardian|wsj|ft\.com/i,
  academic: /scholar\.google|arxiv|researchgate|jstor|sciencedirect/i,
  social: /twitter|facebook|linkedin|reddit|instagram/i,
  email: /mail\.google|outlook/i,
} as const;

export const MAX_CONTEXT_LENGTH = 500;
export const MAX_HISTORY_ITEMS = 100;
