import { useCallback, useEffect, useState } from 'react';
import { STORAGE_KEYS } from '../../shared/constants';

export type EnglishLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export interface UserProfile {
  nickname: string;
  englishLevel: EnglishLevel;
  avatarUrl?: string;
}

interface UseUserProfileResult {
  profile: UserProfile;
  loading: boolean;
  updateProfile: (partial: Partial<UserProfile>) => void;
}

const DEFAULT_PROFILE: UserProfile = {
  nickname: 'Lexi Learner',
  englishLevel: 'B2',
};

function isEnglishLevel(level: unknown): level is EnglishLevel {
  return level === 'A1' ||
    level === 'A2' ||
    level === 'B1' ||
    level === 'B2' ||
    level === 'C1' ||
    level === 'C2';
}

// Simple user profile hook backed by chrome.storage.local.
// For now the profile is read-only in the UI, but updateProfile is exposed
// so future settings surfaces can reuse this hook.
export function useUserProfile(): UseUserProfileResult {
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    try {
      chrome.storage?.local.get(STORAGE_KEYS.USER_PROFILE, (result) => {
        const stored = result?.[STORAGE_KEYS.USER_PROFILE] as Partial<UserProfile> | undefined;

        if (stored && typeof stored === 'object') {
          const next: UserProfile = {
            nickname:
              typeof stored.nickname === 'string' && stored.nickname.trim()
                ? stored.nickname.trim()
                : DEFAULT_PROFILE.nickname,
            englishLevel: isEnglishLevel(stored.englishLevel)
              ? stored.englishLevel
              : DEFAULT_PROFILE.englishLevel,
            avatarUrl:
              typeof stored.avatarUrl === 'string' && stored.avatarUrl.trim()
                ? stored.avatarUrl.trim()
                : undefined,
          };

          setProfile(next);
        }

        setLoading(false);
      });
    } catch {
      // If storage is unavailable, keep default profile for this session.
      setLoading(false);
    }
  }, []);

  const updateProfile = useCallback((partial: Partial<UserProfile>) => {
    setProfile((prev) => {
      const merged: UserProfile = {
        ...prev,
        ...partial,
      };

      try {
        chrome.storage?.local.set({
          [STORAGE_KEYS.USER_PROFILE]: merged,
        });
      } catch {
        // If persistence fails, we still update in-memory state.
      }

      return merged;
    });
  }, []);

  return { profile, loading, updateProfile };
}

