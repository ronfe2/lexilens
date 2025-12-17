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
  const sentence = sentences.find(s => s.includes(word));
  return sentence?.trim() || word;
}

export function debounce<T extends (...args: any[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}
