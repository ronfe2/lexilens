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
