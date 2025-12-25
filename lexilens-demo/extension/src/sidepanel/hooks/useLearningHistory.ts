import { useCallback, useEffect, useState } from 'react';
import {
  DEMO_LEARNING_HISTORY,
  MAX_HISTORY_ITEMS,
  STORAGE_KEYS,
} from '../../shared/constants';
import { IS_DEMO_MODE } from '../../shared/env';
import type { LearningHistoryEntry } from '../../shared/types';

interface UseLearningHistoryResult {
  history: LearningHistoryEntry[];
  words: string[];
  isReady: boolean;
  addEntry: (entry: LearningHistoryEntry) => void;
}

export function useLearningHistory(): UseLearningHistoryResult {
  // In Demo builds, seed with demo history immediately so the very first
  // lookup in a fresh profile still benefits from personalization.
  // In Formal builds, start from an empty history; all personalization is
  // learned from real usage.
  const [history, setHistory] = useState<LearningHistoryEntry[]>(() => {
    if (!IS_DEMO_MODE) return [];

    const now = Date.now();
    return DEMO_LEARNING_HISTORY.map((word) => ({
      word,
      context: '',
      timestamp: now,
    }));
  });
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Prefer real stored history if it exists. Only seed demo data in
    // Demo builds; Formal builds stay empty until the learner interacts.
    try {
      chrome.storage?.local.get(STORAGE_KEYS.LEARNING_HISTORY, (result) => {
        const stored = result?.[STORAGE_KEYS.LEARNING_HISTORY] as
          | LearningHistoryEntry[]
          | undefined;

        if (stored && Array.isArray(stored) && stored.length > 0) {
          setHistory(stored);
          setIsReady(true);
          return;
        }

        if (!IS_DEMO_MODE) {
          setHistory([]);
          setIsReady(true);
          return;
        }

        const now = Date.now();
        const seeded: LearningHistoryEntry[] = DEMO_LEARNING_HISTORY.map((word) => ({
          word,
          context: '',
          timestamp: now,
        }));

        setHistory(seeded);
        try {
          chrome.storage?.local.set({
            [STORAGE_KEYS.LEARNING_HISTORY]: seeded,
          });
        } catch {
          // Ignore persistence errors; keep in-memory state.
        }
        setIsReady(true);
      });
    } catch {
      // When storage is unavailable, only seed demo history for Demo builds.
      if (!IS_DEMO_MODE) {
        setHistory([]);
        setIsReady(true);
        return;
      }

      const now = Date.now();
      const seeded: LearningHistoryEntry[] = DEMO_LEARNING_HISTORY.map((word) => ({
        word,
        context: '',
        timestamp: now,
      }));

      setHistory(seeded);
      setIsReady(true);
    }
  }, []);

  const addEntry = useCallback((entry: LearningHistoryEntry) => {
    setHistory((prev) => {
      const filtered = prev.filter((h) => h.word !== entry.word);
      const updated = [entry, ...filtered].slice(0, MAX_HISTORY_ITEMS);

      chrome.storage?.local.set({
        [STORAGE_KEYS.LEARNING_HISTORY]: updated,
      });

      return updated;
    });
  }, []);

  const words = history.map((h) => h.word.toLowerCase());

  return {
    history,
    words,
    isReady,
    addEntry,
  };
}
