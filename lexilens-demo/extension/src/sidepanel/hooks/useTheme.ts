import { useCallback, useEffect, useState } from 'react';
import { STORAGE_KEYS } from '../../shared/constants';

export type Theme = 'light' | 'dark';

interface Preferences {
  theme?: Theme;
}

interface UseThemeResult {
  theme: Theme;
  initialized: boolean;
  toggleTheme: () => void;
}

// Simple theme preference hook backed by chrome.storage.
// Uses class-based dark mode so Tailwind `dark:` variants work reliably
// inside the sidepanel, regardless of the host page theme.
export function useTheme(): UseThemeResult {
  const [theme, setTheme] = useState<Theme>('light');
  const [initialized, setInitialized] = useState(false);

  // Load stored preference or fall back to system preference
  useEffect(() => {
    try {
      chrome.storage?.local.get(STORAGE_KEYS.PREFERENCES, (result) => {
        const stored = result?.[STORAGE_KEYS.PREFERENCES] as Preferences | undefined;

        const prefersDark =
          window.matchMedia &&
          window.matchMedia('(prefers-color-scheme: dark)').matches;

        const nextTheme: Theme = stored?.theme ?? (prefersDark ? 'dark' : 'light');
        setTheme(nextTheme);
        setInitialized(true);
      });
    } catch {
      // If storage is unavailable, just fall back to light theme
      setTheme('light');
      setInitialized(true);
    }
  }, []);

  // Apply theme class and persist preference
  useEffect(() => {
    if (!initialized) return;

    const root = document.documentElement;

    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    try {
      chrome.storage?.local.set({
        [STORAGE_KEYS.PREFERENCES]: { theme },
      });
    } catch {
      // Ignore storage failures – theme still works for current session
    }
  }, [theme, initialized]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  return { theme, initialized, toggleTheme };
}

