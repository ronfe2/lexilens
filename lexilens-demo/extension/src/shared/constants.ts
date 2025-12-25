import type { InterestTopic, WordbookEntry } from './types';
import { getApiUrl } from './env';

export const API_URL = getApiUrl();

// Default build mode; the env helper in `env.ts` is the single source of truth
// for normalizing `VITE_APP_MODE`, but this constant is useful for docs/tests.
export const APP_MODE_DEFAULT = 'demo';

export const STORAGE_KEYS = {
  LEARNING_HISTORY: 'lexilens_learning_history',
  PREFERENCES: 'lexilens_preferences',
  USER_PROFILE: 'lexilens_user_profile',
  INTERESTS: 'lexilens_interests',
  INTERESTS_BLOCKLIST: 'lexilens_interests_blocklist',
  WORDBOOK: 'lexilens_wordbook',
  ONBOARDING: 'lexilens_onboarding',
} as const;

export const MAX_WORDBOOK_ENTRIES = 500;
export const MAX_SNAPSHOTS_PER_WORD = 5;

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

export const DEMO_INTERESTS: InterestTopic[] = [
  {
    id: 'football',
    title: '英超&世界杯足球',
    summary: '你经常关注英超联赛、欧冠以及世界杯预选赛的新闻和战报。',
    links: [
      {
        url: 'https://example.com/premier-league-report',
        title: 'Premier League match report',
        lastUsedAt: Date.now() - 1000 * 60 * 60 * 6,
      },
      {
        url: 'https://example.com/world-cup-qualifiers',
        title: 'World Cup qualifiers analysis',
        lastUsedAt: Date.now() - 1000 * 60 * 60 * 24,
      },
    ],
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 7,
    updatedAt: Date.now() - 1000 * 60 * 60 * 2,
  },
  {
    id: 'beijing-housing',
    title: '北京买房与城市生活',
    summary: '你会阅读和关注北京楼市走势、购房政策以及城市生活成本的相关内容。',
    links: [
      {
        url: 'https://example.com/beijing-housing-market',
        title: 'Beijing housing market trends',
        lastUsedAt: Date.now() - 1000 * 60 * 60 * 12,
      },
    ],
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 5,
    updatedAt: Date.now() - 1000 * 60 * 60 * 4,
  },
  {
    id: 'llm-work',
    title: '大模型与日常工作',
    summary: '你经常了解大语言模型（LLM）、Prompt 工程和 AI 在工作中的应用。',
    links: [
      {
        url: 'https://example.com/llm-best-practices',
        title: 'Best practices for LLM use',
        lastUsedAt: Date.now() - 1000 * 60 * 30,
      },
    ],
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 3,
    updatedAt: Date.now() - 1000 * 60 * 30,
  },
];

export const DEMO_WORDBOOK: WordbookEntry[] = [
  {
    id: 'leverage',
    word: 'leverage',
    translation: '利用；杠杆作用',
    example: 'We can leverage AI tools to improve productivity.',
    stage: 3,
    lastReviewedAt: Date.now() - 1000 * 60 * 60 * 24,
    isFavorite: true,
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 7,
    updatedAt: Date.now() - 1000 * 60 * 60 * 24,
  },
  {
    id: 'mortgage',
    word: 'mortgage',
    translation: '按揭贷款；抵押贷款',
    example: 'They are discussing mortgage options for a new apartment in Beijing.',
    stage: 2,
    lastReviewedAt: Date.now() - 1000 * 60 * 60 * 48,
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 5,
    updatedAt: Date.now() - 1000 * 60 * 60 * 48,
  },
  {
    id: 'fixture',
    word: 'fixture',
    translation: '（体育）预定比赛；固定装置',
    example: 'The Premier League fixture list was released yesterday.',
    stage: 4,
    lastReviewedAt: Date.now() - 1000 * 60 * 60 * 72,
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 3,
    updatedAt: Date.now() - 1000 * 60 * 60 * 72,
  },
  {
    id: 'corpus',
    word: 'corpus',
    translation: '语料库',
    example: 'The model is trained on a large text corpus.',
    stage: 1,
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 2,
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 2,
  },
];
