import { useCallback, useEffect, useState } from 'react';
import { DEMO_WORDBOOK, STORAGE_KEYS } from '../../shared/constants';
import type { WordbookEntry } from '../../shared/types';

interface UseWordbookResult {
  entries: WordbookEntry[];
  loading: boolean;
  updateStage: (id: string, stage: WordbookEntry['stage']) => void;
}

function sanitizeEntries(input: unknown): WordbookEntry[] {
  if (!Array.isArray(input)) return [];

  const entries: WordbookEntry[] = [];

  for (const raw of input) {
    const entry = raw as Partial<WordbookEntry>;
    if (!entry || typeof entry !== 'object') continue;
    if (typeof entry.id !== 'string' || !entry.id.trim()) continue;
    if (typeof entry.word !== 'string' || !entry.word.trim()) continue;

    const stage =
      typeof entry.stage === 'number' && entry.stage >= 1 && entry.stage <= 5
        ? (entry.stage as WordbookEntry['stage'])
        : 1;

    entries.push({
      id: entry.id.trim(),
      word: entry.word.trim(),
      translation:
        typeof entry.translation === 'string' && entry.translation.trim()
          ? entry.translation.trim()
          : undefined,
      example:
        typeof entry.example === 'string' && entry.example.trim()
          ? entry.example.trim()
          : undefined,
      stage,
      lastReviewedAt:
        typeof entry.lastReviewedAt === 'number' &&
        Number.isFinite(entry.lastReviewedAt)
          ? entry.lastReviewedAt
          : undefined,
    });
  }

  return entries;
}

export function useWordbook(): UseWordbookResult {
  const [entries, setEntries] = useState<WordbookEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      chrome.storage?.local.get(STORAGE_KEYS.WORDBOOK, (result) => {
        const storedRaw = result?.[STORAGE_KEYS.WORDBOOK];
        const storedEntries = sanitizeEntries(storedRaw);

        if (!storedEntries.length) {
          setEntries(DEMO_WORDBOOK);
          chrome.storage?.local.set({
            [STORAGE_KEYS.WORDBOOK]: DEMO_WORDBOOK,
          });
          setLoading(false);
          return;
        }

        setEntries(storedEntries);
        setLoading(false);
      });
    } catch {
      // If storage is unavailable, keep demo entries in-memory.
      setEntries(DEMO_WORDBOOK);
      setLoading(false);
    }
  }, []);

  const updateStage = useCallback(
    (id: string, stage: WordbookEntry['stage']) => {
      setEntries((prev) => {
        const now = Date.now();
        const next = prev.map((entry) =>
          entry.id === id
            ? {
                ...entry,
                stage,
                lastReviewedAt: now,
              }
            : entry,
        );

        try {
          chrome.storage?.local.set({
            [STORAGE_KEYS.WORDBOOK]: next,
          });
        } catch {
          // Ignore persistence errors; in-memory state is updated.
        }

        return next;
      });
    },
    [],
  );

  return {
    entries,
    loading,
    updateStage,
  };
}
