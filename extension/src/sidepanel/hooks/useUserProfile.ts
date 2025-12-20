import { useCallback, useEffect, useState } from 'react';
import { STORAGE_KEYS } from '../../shared/constants';

export type EnglishLevel =
  | 'Starter'
  | 'KET'
  | 'A1'
  | 'A2'
  | 'B1'
  | 'B2'
  | 'C1'
  | 'C2'
  | 'Academic';

export interface EnglishLevelConfig {
  id: EnglishLevel;
  label: string;
  ability: string;
  recommendation: string;
  cefrHint: string;
}

const ALL_LEVELS: EnglishLevel[] = [
  'Starter',
  'KET',
  'A1',
  'A2',
  'B1',
  'B2',
  'C1',
  'C2',
  'Academic',
];

export const ENGLISH_LEVELS: Record<EnglishLevel, EnglishLevelConfig> = {
  Starter: {
    id: 'Starter',
    label: 'Starter',
    ability: 'Can understand a few basic everyday words with help.',
    recommendation: '适合刚开始学英语、重新起步的阶段。',
    cefrHint: 'below A1 (Starter)',
  },
  KET: {
    id: 'KET',
    label: 'KET',
    ability: 'Can understand simple phrases and short everyday sentences.',
    recommendation: '适合日常生活、生存英语，接近 A2 / KET 水平。',
    cefrHint: 'A2 (KET)',
  },
  A1: {
    id: 'A1',
    label: 'A1',
    ability: 'Can understand very basic phrases about familiar topics.',
    recommendation: '适合入门阶段，简单自我介绍和日常问候。',
    cefrHint: 'A1',
  },
  A2: {
    id: 'A2',
    label: 'A2',
    ability: 'Can understand sentences about common everyday topics.',
    recommendation: '适合旅游、简单工作沟通和常见邮件。',
    cefrHint: 'A2',
  },
  B1: {
    id: 'B1',
    label: 'B1',
    ability: 'Can handle most situations while travelling and basic work talk.',
    recommendation: '适合大学英语四级、常见工作场景。',
    cefrHint: 'B1',
  },
  B2: {
    id: 'B2',
    label: 'B2',
    ability: 'Can discuss complex topics and read longer texts with some support.',
    recommendation: '适合大学英语六级、IELTS 6–6.5、日常专业阅读。',
    cefrHint: 'B2',
  },
  C1: {
    id: 'C1',
    label: 'C1',
    ability: 'Can use English flexibly for work and academic study.',
    recommendation: '适合高级职场沟通、演讲、IELTS 7+。',
    cefrHint: 'C1',
  },
  C2: {
    id: 'C2',
    label: 'C2',
    ability: 'Can understand almost everything and express ideas precisely.',
    recommendation: '接近母语水平，适合高阶学术和专业写作。',
    cefrHint: 'C2',
  },
  Academic: {
    id: 'Academic',
    label: 'Academic',
    ability: 'Comfortable reading and writing academic papers and reports.',
    recommendation: '适合研究生、科研论文和学术写作场景。',
    cefrHint: 'C1–C2 Academic',
  },
};

export function getLevelConfig(level: EnglishLevel): EnglishLevelConfig {
  return ENGLISH_LEVELS[level] ?? ENGLISH_LEVELS.B2;
}

export function getCefrForPrompt(level: EnglishLevel): string {
  return getLevelConfig(level).cefrHint;
}

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
  return (
    typeof level === 'string' &&
    (ALL_LEVELS as string[]).includes(level)
  );
}

// Simple user profile hook backed by chrome.storage.local.
export function useUserProfile(): UseUserProfileResult {
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    try {
      chrome.storage?.local.get(STORAGE_KEYS.USER_PROFILE, (result) => {
        const stored = result?.[STORAGE_KEYS.USER_PROFILE] as Partial<UserProfile> | undefined;

        if (stored && typeof stored === 'object') {
          const nextLevel =
            isEnglishLevel(stored.englishLevel) ? stored.englishLevel : DEFAULT_PROFILE.englishLevel;

          const next: UserProfile = {
            nickname:
              typeof stored.nickname === 'string' && stored.nickname.trim()
                ? stored.nickname.trim()
                : DEFAULT_PROFILE.nickname,
            englishLevel: nextLevel,
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
