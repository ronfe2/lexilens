import { useCallback, useEffect, useState } from 'react';
import {
  DEMO_WORDBOOK,
  MAX_SNAPSHOTS_PER_WORD,
  MAX_WORDBOOK_ENTRIES,
  STORAGE_KEYS,
} from '../../shared/constants';
import type {
  AnalysisRequest,
  AnalysisResult,
  WordbookEntry,
  WordbookSnapshot,
} from '../../shared/types';

interface UseWordbookResult {
  entries: WordbookEntry[];
  loading: boolean;

  // Stage & exposure
  updateStage: (id: string, stage: WordbookEntry['stage']) => void;
  incrementStageForWord: (
    word: string,
    reason: 'analysis' | 'lexical-map',
  ) => void;

  // Persistence of explanations
  upsertEntryFromAnalysis: (params: {
    request: AnalysisRequest;
    analysis: AnalysisResult;
  }) => void;

  // Lexical Map images
  recordLexicalImage: (params: {
    word: string;
    baseWord: string;
    relatedWord: string;
    imageUrl: string;
    prompt?: string;
  }) => void;

  // Favorites & deletion
  toggleFavoriteByWord: (word: string) => void;
  deleteEntry: (id: string) => void;
}

function normalizeWord(input: string): string {
  return input.trim();
}

function normalizeWordLower(input: string): string {
  return normalizeWord(input).toLowerCase();
}

function generateSnapshotId(word: string): string {
  const normalized = normalizeWordLower(word) || 'word';
  return `${normalized}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function sanitizeSnapshot(
  raw: unknown,
  fallbackWord: string,
): WordbookSnapshot | null {
  if (!raw || typeof raw !== 'object') return null;

  const anySnapshot = raw as any;
  const now = Date.now();

  const id =
    typeof anySnapshot.id === 'string' && anySnapshot.id.trim().length > 0
      ? anySnapshot.id.trim()
      : generateSnapshotId(fallbackWord);

  const createdAt =
    typeof anySnapshot.createdAt === 'number' &&
    Number.isFinite(anySnapshot.createdAt)
      ? anySnapshot.createdAt
      : now;

  const requestRaw = anySnapshot.request ?? {};
  const context =
    typeof requestRaw.context === 'string' && requestRaw.context.trim().length > 0
      ? requestRaw.context.trim()
      : '';

  const pageType = requestRaw.pageType as AnalysisRequest['pageType'] | undefined;

  const url =
    typeof requestRaw.url === 'string' && requestRaw.url.trim().length > 0
      ? requestRaw.url.trim()
      : undefined;

  const analysis = anySnapshot.analysis as AnalysisResult | undefined;
  if (!analysis || typeof analysis !== 'object') {
    return null;
  }

  let lexicalImages: WordbookSnapshot['lexicalImages'] | undefined;
  if (Array.isArray(anySnapshot.lexicalImages)) {
    const images: NonNullable<WordbookSnapshot['lexicalImages']> = [];

    for (const rawImage of anySnapshot.lexicalImages) {
      if (!rawImage || typeof rawImage !== 'object') continue;
      const img: any = rawImage;

      const baseWord =
        typeof img.baseWord === 'string' && img.baseWord.trim().length > 0
          ? img.baseWord.trim()
          : null;
      const relatedWord =
        typeof img.relatedWord === 'string' && img.relatedWord.trim().length > 0
          ? img.relatedWord.trim()
          : null;
      const imageUrl =
        typeof img.imageUrl === 'string' && img.imageUrl.trim().length > 0
          ? img.imageUrl.trim()
          : null;

      if (!baseWord || !relatedWord || !imageUrl) continue;

      const prompt =
        typeof img.prompt === 'string' && img.prompt.trim().length > 0
          ? img.prompt.trim()
          : undefined;

      const imageCreatedAt =
        typeof img.createdAt === 'number' && Number.isFinite(img.createdAt)
          ? img.createdAt
          : now;

      images.push({
        baseWord,
        relatedWord,
        imageUrl,
        prompt,
        createdAt: imageCreatedAt,
      });
    }

    if (images.length > 0) {
      lexicalImages = images;
    }
  }

  return {
    id,
    createdAt,
    request: {
      context,
      pageType,
      url,
    },
    analysis,
    lexicalImages,
  };
}

function sanitizeEntries(input: unknown): WordbookEntry[] {
  if (!Array.isArray(input)) return [];

  const entries: WordbookEntry[] = [];
  const now = Date.now();

  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue;
    const entry = raw as any;

    const id =
      typeof entry.id === 'string' && entry.id.trim().length > 0
        ? entry.id.trim()
        : null;
    const word =
      typeof entry.word === 'string' && entry.word.trim().length > 0
        ? entry.word.trim()
        : null;

    if (!id || !word) continue;

    const stageNumber =
      typeof entry.stage === 'number' &&
      Number.isFinite(entry.stage) &&
      entry.stage >= 1 &&
      entry.stage <= 5
        ? entry.stage
        : 1;
    const stage = stageNumber as WordbookEntry['stage'];

    const translation =
      typeof entry.translation === 'string' && entry.translation.trim().length > 0
        ? entry.translation.trim()
        : undefined;

    const example =
      typeof entry.example === 'string' && entry.example.trim().length > 0
        ? entry.example.trim()
        : undefined;

    const lastReviewedAt =
      typeof entry.lastReviewedAt === 'number' &&
      Number.isFinite(entry.lastReviewedAt)
        ? entry.lastReviewedAt
        : undefined;

    const isFavorite =
      typeof entry.isFavorite === 'boolean' ? entry.isFavorite : undefined;

    let createdAt: number;
    if (typeof entry.createdAt === 'number' && Number.isFinite(entry.createdAt)) {
      createdAt = entry.createdAt;
    } else if (typeof lastReviewedAt === 'number') {
      createdAt = lastReviewedAt;
    } else {
      createdAt = now;
    }

    const updatedAt =
      typeof entry.updatedAt === 'number' && Number.isFinite(entry.updatedAt)
        ? entry.updatedAt
        : createdAt;

    let latestSnapshot: WordbookSnapshot | undefined;
    if (entry.latestSnapshot) {
      const snapshot = sanitizeSnapshot(entry.latestSnapshot, word);
      if (snapshot) {
        latestSnapshot = snapshot;
      }
    }

    let snapshots: WordbookSnapshot[] | undefined;
    if (Array.isArray(entry.snapshots)) {
      const sanitizedSnapshots: WordbookSnapshot[] = [];
      for (const rawSnapshot of entry.snapshots) {
        const snapshot = sanitizeSnapshot(rawSnapshot, word);
        if (snapshot) sanitizedSnapshots.push(snapshot);
      }
      if (sanitizedSnapshots.length > 0) {
        snapshots = sanitizedSnapshots.slice(0, MAX_SNAPSHOTS_PER_WORD);
      }
    }

    entries.push({
      id,
      word,
      translation,
      example,
      stage,
      lastReviewedAt,
      isFavorite,
      createdAt,
      updatedAt,
      latestSnapshot,
      snapshots,
    });
  }

  return entries;
}

function persistEntries(entries: WordbookEntry[]): void {
  try {
    chrome.storage?.local.set({
      [STORAGE_KEYS.WORDBOOK]: entries,
    });
  } catch {
    // Ignore persistence errors; in-memory state is updated.
  }
}

function enforceWordbookLimits(entries: WordbookEntry[]): WordbookEntry[] {
  if (
    typeof MAX_WORDBOOK_ENTRIES !== 'number' ||
    !Number.isFinite(MAX_WORDBOOK_ENTRIES)
  ) {
    return entries;
  }

  if (entries.length <= MAX_WORDBOOK_ENTRIES) {
    return entries;
  }

  const toRemoveCount = entries.length - MAX_WORDBOOK_ENTRIES;
  if (toRemoveCount <= 0) return entries;

  const getCreatedTime = (entry: WordbookEntry): number =>
    entry.createdAt ?? entry.lastReviewedAt ?? 0;

  const nonFavorites = entries.filter((e) => !e.isFavorite);
  const favorites = entries.filter((e) => e.isFavorite);

  const byOldest = (a: WordbookEntry, b: WordbookEntry) =>
    getCreatedTime(a) - getCreatedTime(b);

  const removalIds = new Set<string>();
  let remainingToRemove = toRemoveCount;

  for (const entry of [...nonFavorites].sort(byOldest)) {
    if (remainingToRemove <= 0) break;
    removalIds.add(entry.id);
    remainingToRemove -= 1;
  }

  if (remainingToRemove > 0) {
    for (const entry of [...favorites].sort(byOldest)) {
      if (remainingToRemove <= 0) break;
      removalIds.add(entry.id);
      remainingToRemove -= 1;
    }
  }

  if (removalIds.size === 0) return entries;
  return entries.filter((entry) => !removalIds.has(entry.id));
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
          persistEntries(DEMO_WORDBOOK);
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
        const clampedStage = Math.min(5, Math.max(1, stage)) as WordbookEntry['stage'];

        const next = prev.map((entry) =>
          entry.id === id
            ? {
                ...entry,
                stage: clampedStage,
                lastReviewedAt: now,
                updatedAt: now,
              }
            : entry,
        );

        const limited = enforceWordbookLimits(next);
        persistEntries(limited);
        return limited;
      });
    },
    [],
  );

  const incrementStageForWord = useCallback(
    (word: string, reason: 'analysis' | 'lexical-map') => {
      const normalized = normalizeWord(word);
      if (!normalized) return;
      const lowered = normalized.toLowerCase();
      // `reason` is reserved for future analytics or differentiated behavior.
      void reason;

      setEntries((prev) => {
        const now = Date.now();
        let found = false;

        const next = prev.map((entry) => {
          if (entry.word.toLowerCase() !== lowered) return entry;

          found = true;
          const currentStage =
            typeof entry.stage === 'number' && entry.stage >= 1 && entry.stage <= 5
              ? entry.stage
              : 1;
          const nextStage = Math.min(
            5,
            currentStage + 1,
          ) as WordbookEntry['stage'];

          return {
            ...entry,
            stage: nextStage,
            lastReviewedAt: now,
            updatedAt: now,
          };
        });

        if (!found) return prev;

        const limited = enforceWordbookLimits(next);
        persistEntries(limited);
        return limited;
      });
    },
    [],
  );

  const upsertEntryFromAnalysis = useCallback(
    (params: { request: AnalysisRequest; analysis: AnalysisResult }) => {
      const { request, analysis } = params;
      const normalizedWord = normalizeWord(request.word);
      if (!normalizedWord) return;

      setEntries((prev) => {
        const now = Date.now();
        const lower = normalizedWord.toLowerCase();

        const snapshot: WordbookSnapshot = {
          id: generateSnapshotId(normalizedWord),
          createdAt: now,
          request: {
            context: request.context,
            pageType: request.pageType,
            url: request.url,
          },
          analysis,
          lexicalImages: [],
        };

        const existingIndex = prev.findIndex(
          (entry) => entry.word.toLowerCase() === lower,
        );

        let next: WordbookEntry[];

        if (existingIndex === -1) {
          const baseId = lower || 'word';
          const existingIds = new Set(prev.map((e) => e.id));
          let id = baseId;
          let suffix = 1;

          while (existingIds.has(id)) {
            id = `${baseId}-${suffix}`;
            suffix += 1;
          }

          const createdAt = now;
          const newEntry: WordbookEntry = {
            id,
            word: normalizedWord,
            translation: undefined,
            example: undefined,
            stage: 1,
            lastReviewedAt: undefined,
            isFavorite: false,
            createdAt,
            updatedAt: createdAt,
            latestSnapshot: snapshot,
            snapshots: [snapshot],
          };

          next = [...prev, newEntry];
        } else {
          next = prev.map((entry, index) => {
            if (index !== existingIndex) return entry;

            const existingSnapshots = Array.isArray(entry.snapshots)
              ? entry.snapshots
              : [];

            const deduped = [
              snapshot,
              ...existingSnapshots.filter((s) => s.id !== snapshot.id),
            ];

            const limitedSnapshots =
              deduped.length > MAX_SNAPSHOTS_PER_WORD
                ? deduped.slice(0, MAX_SNAPSHOTS_PER_WORD)
                : deduped;

            return {
              ...entry,
              latestSnapshot: snapshot,
              snapshots: limitedSnapshots,
              updatedAt: now,
            };
          });
        }

        const limited = enforceWordbookLimits(next);
        persistEntries(limited);
        return limited;
      });
    },
    [],
  );

  const recordLexicalImage = useCallback(
    (params: {
      word: string;
      baseWord: string;
      relatedWord: string;
      imageUrl: string;
      prompt?: string;
    }) => {
      const normalizedWord = normalizeWord(params.word);
      if (!normalizedWord) return;
      const lowered = normalizedWord.toLowerCase();

      setEntries((prev) => {
        const now = Date.now();
        let updated = false;

        const next = prev.map((entry) => {
          if (entry.word.toLowerCase() !== lowered) return entry;
          if (!entry.latestSnapshot) return entry;

          const existingImages =
            entry.latestSnapshot.lexicalImages ?? [];

          const nextImages = [
            ...existingImages,
            {
              baseWord: params.baseWord,
              relatedWord: params.relatedWord,
              imageUrl: params.imageUrl,
              prompt: params.prompt,
              createdAt: now,
            },
          ];

          const updatedSnapshot: WordbookSnapshot = {
            ...entry.latestSnapshot,
            lexicalImages: nextImages,
          };

          updated = true;

          return {
            ...entry,
            latestSnapshot: updatedSnapshot,
            updatedAt: now,
          };
        });

        if (!updated) return prev;

        const limited = enforceWordbookLimits(next);
        persistEntries(limited);
        return limited;
      });
    },
    [],
  );

  const toggleFavoriteByWord = useCallback((word: string) => {
    const normalized = normalizeWord(word);
    if (!normalized) return;
    const lowered = normalized.toLowerCase();

      setEntries((prev) => {
        const now = Date.now();
        const existingIndex = prev.findIndex(
          (entry) => entry.word.toLowerCase() === lowered,
        );

      let next: WordbookEntry[];

      if (existingIndex === -1) {
        const baseId = lowered || 'word';
        const existingIds = new Set(prev.map((e) => e.id));
        let id = baseId;
        let suffix = 1;

        while (existingIds.has(id)) {
          id = `${baseId}-${suffix}`;
          suffix += 1;
        }

        const createdAt = now;

        const newEntry: WordbookEntry = {
          id,
          word: normalized,
          translation: undefined,
          example: undefined,
          stage: 1,
          lastReviewedAt: undefined,
          isFavorite: true,
          createdAt,
          updatedAt: createdAt,
          latestSnapshot: undefined,
          snapshots: undefined,
        };

        next = [...prev, newEntry];
      } else {
        next = prev.map((entry, index) =>
          index === existingIndex
            ? {
                ...entry,
                isFavorite: !entry.isFavorite,
                updatedAt: now,
              }
            : entry,
        );
      }

      const limited = enforceWordbookLimits(next);
      persistEntries(limited);
      return limited;
    });
  }, []);

  const deleteEntry = useCallback((id: string) => {
    setEntries((prev) => {
      const next = prev.filter((entry) => entry.id !== id);
      persistEntries(next);
      return next;
    });
  }, []);

  return {
    entries,
    loading,
    updateStage,
    incrementStageForWord,
    upsertEntryFromAnalysis,
    recordLexicalImage,
    toggleFavoriteByWord,
    deleteEntry,
  };
}
