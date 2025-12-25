// Centralized environment helpers for the extension.
// Keeps Demo vs Formal behavior in one place so hooks/components can
// make consistent decisions without reaching into import.meta.env directly.

type AppMode = 'demo' | 'production';

function normalizeAppMode(raw: string | undefined): AppMode {
  if (raw === 'production') {
    return 'production';
  }
  // Default to "demo" when unset or any other value is provided.
  return 'demo';
}

const rawMode =
  typeof import.meta !== 'undefined' && import.meta.env
    ? (import.meta.env.VITE_APP_MODE as string | undefined)
    : undefined;

export const APP_MODE: AppMode = normalizeAppMode(rawMode);
export const IS_DEMO_MODE = APP_MODE === 'demo';
export const IS_FORMAL_MODE = APP_MODE === 'production';

export function getApiUrl(): string {
  const raw =
    typeof import.meta !== 'undefined' && import.meta.env
      ? import.meta.env.VITE_API_URL
      : undefined;

  return raw && typeof raw === 'string' && raw.trim().length > 0
    ? raw.trim()
    : 'http://localhost:8000';
}

