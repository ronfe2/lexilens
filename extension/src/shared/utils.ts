import { PAGE_TYPE_PATTERNS, MAX_CONTEXT_LENGTH } from './constants';
import type { AnalysisRequest } from './types';

export function detectPageType(url: string): AnalysisRequest['pageType'] {
  for (const [type, pattern] of Object.entries(PAGE_TYPE_PATTERNS)) {
    if (pattern.test(url)) {
      return type as AnalysisRequest['pageType'];
    }
  }
  return 'other';
}

export function extractContext(selectedText: string, fullText: string): string {
  const index = fullText.indexOf(selectedText);
  if (index === -1) return selectedText;

  const start = Math.max(0, index - MAX_CONTEXT_LENGTH / 2);
  const end = Math.min(fullText.length, index + selectedText.length + MAX_CONTEXT_LENGTH / 2);

  let context = fullText.slice(start, end).trim();

  if (start > 0) context = '...' + context;
  if (end < fullText.length) context = context + '...';

  return context;
}

export function getSentenceContaining(word: string, text: string): string {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const sentence = sentences.find((s) => s.includes(word));
  return sentence?.trim() || word;
}

export function debounce<T extends (...args: any[]) => void>(
  func: T,
  wait: number,
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

/**
 * Heuristic to decide whether a selected entry (word, phrase, sentence)
 * is "long" enough that we should avoid rendering it in full in tight UI
 * spots like headings or labels.
 */
export function isLongEntry(
  text: string,
  maxWords = 4,
  maxChars = 30,
): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;

  const words = trimmed.split(/\s+/);

  if (words.length > maxWords) return true;
  if (trimmed.length > maxChars) return true;

  // Treat something that looks like a full sentence as "long"
  if (/[.!?。！？]/.test(trimmed) && words.length > 1) {
    return true;
  }

  return false;
}

/**
 * Build a short label from potentially long text (sentence/paragraph).
 * Used for places like Lexical Map nodes or compact headings where we
 * only want a concise, front-loaded snippet.
 */
export function createShortLabel(
  text: string,
  options?: {
    maxWords?: number;
    maxChars?: number;
  },
): string {
  const trimmed = text.trim();
  if (!trimmed) return '';

  const maxWords = options?.maxWords ?? 4;
  const maxChars = options?.maxChars ?? 40;

  const words = trimmed.split(/\s+/);
  const hasSentencePunctuation = /[.!?。！？]/.test(trimmed);

  const isAlreadyShort =
    trimmed.length <= maxChars &&
    words.length <= maxWords &&
    !hasSentencePunctuation;

  if (isAlreadyShort) {
    return trimmed;
  }

  const candidate = words.slice(0, maxWords).join(' ');
  return truncateText(candidate, maxChars);
}

// Lightweight English stopword list to help pick meaningful keywords
// from long sentences when we need a compact label.
const STOPWORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'but',
  'if',
  'then',
  'so',
  'because',
  'as',
  'of',
  'in',
  'on',
  'at',
  'for',
  'to',
  'from',
  'by',
  'with',
  'about',
  'into',
  'over',
  'after',
  'before',
  'between',
  'without',
  'within',
  'during',
  'including',
  'until',
  'against',
  'among',
  'throughout',
  'despite',
  'toward',
  'upon',
  'around',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'do',
  'does',
  'did',
  'has',
  'have',
  'had',
  'will',
  'would',
  'can',
  'could',
  'should',
  'may',
  'might',
  'must',
  'this',
  'that',
  'these',
  'those',
  'it',
  'its',
  'their',
  'they',
  'them',
  'he',
  'him',
  'she',
  'her',
  'you',
  'your',
  'we',
  'our',
  'i',
  'me',
  'my',
  'many',
]);

function normalizeToken(raw: string): string {
  return raw.replace(/^[^\w]+|[^\w]+$/g, '').toLowerCase();
}

/**
 * Try to extract a single keyword from a longer sentence/paragraph.
 * Used for the Lexical Map中心节点，把整句压缩成一个更自然的核心词。
 */
export function extractKeywordFromText(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const rawTokens = trimmed.split(/\s+/);

  type KeywordStats = {
    count: number;
    firstIndex: number;
    original: string;
    isCapitalized: boolean;
  };

  const stats: Record<string, KeywordStats> = {};

  rawTokens.forEach((raw, index) => {
    const cleaned = normalizeToken(raw);
    if (!cleaned || STOPWORDS.has(cleaned)) {
      return;
    }

    const isCapitalized = /^[A-Z]/.test(raw);
    if (!stats[cleaned]) {
      stats[cleaned] = {
        count: 0,
        firstIndex: index,
        // Strip surrounding punctuation but preserve original casing
        original: raw.replace(/^[^\w]+|[^\w]+$/g, ''),
        isCapitalized,
      };
    }
    stats[cleaned].count += 1;
  });

  const entries = Object.entries(stats);
  if (!entries.length) {
    return null;
  }

  // Score keywords by:
  // 1) higher frequency
  // 2) longer length (tends to pick more contentful words)
  // 3) capitalized (for proper nouns) when not at position 0
  // 4) earlier position as a final tiebreaker
  let best: KeywordStats | null = null;

  for (const [, info] of entries) {
    const lengthScore = info.original.length;
    const capitalBonus = info.isCapitalized && info.firstIndex > 0 ? 2 : 0;
    const score = info.count * 10 + lengthScore + capitalBonus;

    if (!best) {
      best = { ...info, count: score };
    } else if (score > best.count) {
      best = { ...info, count: score };
    }
  }

  if (!best) return null;

  // Use the original casing as it appeared in the sentence.
  return best.original || null;
}
