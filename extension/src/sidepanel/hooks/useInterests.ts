import { useCallback, useEffect, useState } from 'react';
import { DEMO_INTERESTS, STORAGE_KEYS } from '../../shared/constants';
import type { InterestLink, InterestTopic } from '../../shared/types';

interface UseInterestsResult {
  topics: InterestTopic[];
  blockedTitles: string[];
  loading: boolean;
  addOrUpdateFromServer: (updatedTopics: InterestTopic[]) => void;
  addLinkToTopic: (topicId: string, link: InterestLink) => void;
  removeLink: (topicId: string, url: string) => void;
  deleteTopic: (topicId: string) => void;
}

function sanitizeLinks(input: unknown): InterestLink[] {
  if (!Array.isArray(input)) return [];

  const links: InterestLink[] = [];

  for (const raw of input) {
    const link = raw as Partial<InterestLink>;
    if (!link || typeof link !== 'object') continue;
    if (typeof link.url !== 'string' || !link.url.trim()) continue;

    const cleaned: InterestLink = {
      url: link.url.trim(),
      title:
        typeof link.title === 'string' && link.title.trim()
          ? link.title.trim()
          : undefined,
      lastUsedAt:
        typeof link.lastUsedAt === 'number' && Number.isFinite(link.lastUsedAt)
          ? link.lastUsedAt
          : Date.now(),
    };

    links.push(cleaned);
  }

  return links;
}

function sanitizeTopics(input: unknown): InterestTopic[] {
  if (!Array.isArray(input)) return [];

  const topics: InterestTopic[] = [];
  const now = Date.now();

  for (const raw of input) {
    const topic = raw as Partial<InterestTopic>;
    if (!topic || typeof topic !== 'object') continue;

    const title =
      typeof topic.title === 'string' && topic.title.trim()
        ? topic.title.trim()
        : undefined;
    const id =
      typeof topic.id === 'string' && topic.id.trim()
        ? topic.id.trim()
        : title
        ? title.toLowerCase().replace(/\s+/g, '-')
        : undefined;

    if (!id || !title) continue;

    const summary =
      typeof topic.summary === 'string' && topic.summary.trim()
        ? topic.summary.trim()
        : '';

    const links = sanitizeLinks((topic as any).links);

    topics.push({
      id,
      title,
      summary,
      links,
      createdAt:
        typeof topic.createdAt === 'number' && Number.isFinite(topic.createdAt)
          ? topic.createdAt
          : now,
      updatedAt:
        typeof topic.updatedAt === 'number' && Number.isFinite(topic.updatedAt)
          ? topic.updatedAt
          : now,
    });
  }

  return topics;
}

export function useInterests(): UseInterestsResult {
  const [topics, setTopics] = useState<InterestTopic[]>([]);
  const [blockedTitles, setBlockedTitles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      chrome.storage?.local.get(
        [STORAGE_KEYS.INTERESTS, STORAGE_KEYS.INTERESTS_BLOCKLIST],
        (result) => {
          const storedRaw = result?.[STORAGE_KEYS.INTERESTS];
          const storedTopics = sanitizeTopics(storedRaw);

          const storedBlocked = result?.[STORAGE_KEYS.INTERESTS_BLOCKLIST];
          const blocked: string[] = Array.isArray(storedBlocked)
            ? storedBlocked.filter(
                (t): t is string => typeof t === 'string' && t.trim().length > 0,
              )
            : [];

          // Seed demo interests if nothing stored yet.
          if (!storedTopics.length) {
            setTopics(DEMO_INTERESTS);
            setBlockedTitles(blocked);
            chrome.storage?.local.set({
              [STORAGE_KEYS.INTERESTS]: DEMO_INTERESTS,
              [STORAGE_KEYS.INTERESTS_BLOCKLIST]: blocked,
            });
            setLoading(false);
            return;
          }

          setTopics(storedTopics);
          setBlockedTitles(blocked);
          setLoading(false);
        },
      );
    } catch {
      // If storage is unavailable, fall back to demo interests for this session.
      setTopics(DEMO_INTERESTS);
      setLoading(false);
    }
  }, []);

  const persist = useCallback(
    (nextTopics: InterestTopic[], nextBlocked: string[]) => {
      try {
        chrome.storage?.local.set({
          [STORAGE_KEYS.INTERESTS]: nextTopics,
          [STORAGE_KEYS.INTERESTS_BLOCKLIST]: nextBlocked,
        });
      } catch {
        // Ignore persistence errors; in-memory state is still updated.
      }
    },
    [],
  );

  const addOrUpdateFromServer = useCallback(
    (updatedTopics: InterestTopic[]) => {
      const sanitized = sanitizeTopics(updatedTopics).filter(
        (t) => !blockedTitles.includes(t.title),
      );
      setTopics(sanitized);
      persist(sanitized, blockedTitles);
    },
    [blockedTitles, persist],
  );

  const addLinkToTopic = useCallback(
    (topicId: string, link: InterestLink) => {
      setTopics((prev) => {
        const now = Date.now();
        const normalizedLink: InterestLink = {
          url: link.url,
          title: link.title,
          lastUsedAt: link.lastUsedAt || now,
        };

        const next = prev.map((topic) =>
          topic.id === topicId
            ? {
                ...topic,
                links: [
                  normalizedLink,
                  ...topic.links.filter((l) => l.url !== normalizedLink.url),
                ],
                updatedAt: now,
              }
            : topic,
        );

        persist(next, blockedTitles);
        return next;
      });
    },
    [blockedTitles, persist],
  );

  const removeLink = useCallback(
    (topicId: string, url: string) => {
      setTopics((prev) => {
        const now = Date.now();
        const next = prev.map((topic) =>
          topic.id === topicId
            ? {
                ...topic,
                links: topic.links.filter((link) => link.url !== url),
                updatedAt: now,
              }
            : topic,
        );

        persist(next, blockedTitles);
        return next;
      });
    },
    [blockedTitles, persist],
  );

  const deleteTopic = useCallback(
    (topicId: string) => {
      setTopics((prev) => {
        const topicToDelete = prev.find((t) => t.id === topicId);
        const titleToBlock = topicToDelete?.title?.trim();

        const nextTopics = prev.filter((t) => t.id !== topicId);
        let nextBlocked = blockedTitles;

        if (titleToBlock && !blockedTitles.includes(titleToBlock)) {
          nextBlocked = [...blockedTitles, titleToBlock];
        }

        setBlockedTitles(nextBlocked);
        persist(nextTopics, nextBlocked);
        return nextTopics;
      });
    },
    [blockedTitles, persist],
  );

  return {
    topics,
    blockedTitles,
    loading,
    addOrUpdateFromServer,
    addLinkToTopic,
    removeLink,
    deleteTopic,
  };
}
