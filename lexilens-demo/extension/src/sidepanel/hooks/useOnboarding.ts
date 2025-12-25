import { useCallback, useEffect, useState } from 'react';
import { STORAGE_KEYS } from '../../shared/constants';
import { IS_DEMO_MODE, IS_FORMAL_MODE } from '../../shared/env';
import type { OnboardingState } from '../../shared/types';

interface UseOnboardingResult {
  state: OnboardingState;
  shouldShowOnboarding: boolean;
  loading: boolean;
  markCompleted: () => void;
  reset: () => void;
}

const DEFAULT_ONBOARDING_STATE: OnboardingState = {
  completed: false,
};

const ONBOARDING_VERSION = 1;

function sanitizeOnboardingState(raw: unknown): OnboardingState {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_ONBOARDING_STATE };
  }

  const anyState = raw as any;

  const completed =
    typeof anyState.completed === 'boolean' ? anyState.completed : false;

  const completedAt =
    typeof anyState.completedAt === 'number' &&
    Number.isFinite(anyState.completedAt)
      ? anyState.completedAt
      : undefined;

  const version =
    typeof anyState.version === 'number' && Number.isFinite(anyState.version)
      ? anyState.version
      : undefined;

  return {
    completed,
    completedAt,
    version,
  };
}

function getStorageKey(): string {
  // Keep Demo and Formal builds isolated so they do not accidentally share
  // onboarding state when loaded in the same browser profile.
  const prefix = IS_DEMO_MODE ? 'demo_' : 'formal_';
  return `${prefix}${STORAGE_KEYS.ONBOARDING}`;
}

export function useOnboarding(): UseOnboardingResult {
  const [state, setState] = useState<OnboardingState>(DEFAULT_ONBOARDING_STATE);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const key = getStorageKey();

    try {
      chrome.storage?.local.get(key, (result) => {
        const storedRaw = result?.[key];
        const sanitized = sanitizeOnboardingState(storedRaw);

        // If we ever bump the onboarding version, treat older versions as
        // incomplete so users can see any new guidance we add.
        if (
          typeof sanitized.version === 'number' &&
          sanitized.version !== ONBOARDING_VERSION
        ) {
          const next: OnboardingState = {
            completed: false,
            completedAt: undefined,
            version: ONBOARDING_VERSION,
          };
          setState(next);
          setLoading(false);
          return;
        }

        const next: OnboardingState = {
          ...sanitized,
          version: sanitized.version ?? ONBOARDING_VERSION,
        };

        setState(next);
        setLoading(false);
      });
    } catch {
      // If storage is unavailable, keep onboarding state in-memory only.
      setState({
        ...DEFAULT_ONBOARDING_STATE,
        version: ONBOARDING_VERSION,
      });
      setLoading(false);
    }
  }, []);

  const persist = useCallback((next: OnboardingState) => {
    const key = getStorageKey();
    try {
      chrome.storage?.local.set({
        [key]: next,
      });
    } catch {
      // Ignore persistence errors; in-memory state is already updated.
    }
  }, []);

  const markCompleted = useCallback(() => {
    const now = Date.now();

    setState((prev) => {
      const next: OnboardingState = {
        ...prev,
        completed: true,
        completedAt: now,
        version: ONBOARDING_VERSION,
      };

      persist(next);
      return next;
    });
  }, [persist]);

  const reset = useCallback(() => {
    const key = getStorageKey();

    setState({
      completed: false,
      completedAt: undefined,
      version: ONBOARDING_VERSION,
    });

    try {
      chrome.storage?.local.remove(key);
    } catch {
      // Non-critical; state has already been reset in-memory.
    }
  }, []);

  // Only Formal builds should auto-open onboarding; Demo builds always
  // return `false` here, but can still open the panel manually via the
  // Help / Guide entry point in the UI.
  const shouldShowOnboarding =
    IS_FORMAL_MODE && !loading && !state.completed;

  return {
    state,
    shouldShowOnboarding,
    loading,
    markCompleted,
    reset,
  };
}

