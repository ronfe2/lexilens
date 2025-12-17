import { useCallback, useEffect, useState } from 'react';
import {
  DEMO_LEARNING_HISTORY,
  MAX_HISTORY_ITEMS,
  STORAGE_KEYS,
} from '../../shared/constants';
import type { LearningHistoryEntry } from '../../shared/types';

interface UseLearningHistoryResult {
  history: LearningHistoryEntry[];
  words: string[];
  isReady: boolean;
  addEntry: (entry: LearningHistoryEntry) => void;
}

export function useLearningHistory(): UseLearningHistoryResult {
  const [history, setHistory] = useState<LearningHistoryEntry[]>([]);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Seed demo history for hackathon wow-effect, then respect user data
    chrome.storage?.local.get(STORAGE_KEYS.LEARNING_HISTORY, (result) => {
      const stored = result?.[STORAGE_KEYS.LEARNING_HISTORY] as
        | LearningHistoryEntry[]
        | undefined;

      if (stored && Array.isArray(stored) && stored.length > 0) {
        setHistory(stored);
        setIsReady(true);
        return;
      }

      const seeded: LearningHistoryEntry[] = DEMO_LEARNING_HISTORY.map((word) => ({
        word,
        context: '',
        timestamp: Date.now(),
      }));

      setHistory(seeded);
      chrome.storage?.local.set({
        [STORAGE_KEYS.LEARNING_HISTORY]: seeded,
      });
      setIsReady(true);
    });
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

