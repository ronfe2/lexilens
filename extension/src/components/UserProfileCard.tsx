import { Moon, Sun, User } from 'lucide-react';
import type { UserProfile } from '../sidepanel/hooks/useUserProfile';
import type { Theme } from '../sidepanel/hooks/useTheme';

interface UserProfileCardProps {
  profile: UserProfile;
  className?: string;
  theme?: Theme;
  onToggleTheme?: () => void;
}

const levelLabels: Record<UserProfile['englishLevel'], string> = {
  A1: '入门',
  A2: '基础',
  B1: '中级',
  B2: '中高级',
  C1: '高级',
  C2: '接近母语',
};

export default function UserProfileCard({
  profile,
  className = '',
  theme = 'light',
  onToggleTheme,
}: UserProfileCardProps) {
  const initial =
    (profile.nickname && profile.nickname.trim().charAt(0).toUpperCase()) || 'L';

  const levelLabel = levelLabels[profile.englishLevel] ?? '';

  return (
    <section
      className={`glass glass-border rounded-xl px-4 py-3 flex items-center justify-between gap-3 ${className}`}
      aria-label="User profile"
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="relative">
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-sm font-semibold text-white shadow-md">
            {profile.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt={profile.nickname}
                className="h-full w-full rounded-full object-cover"
              />
            ) : (
              initial
            )}
          </div>
          <div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-white dark:bg-gray-900 flex items-center justify-center shadow-sm">
            <User className="h-3 w-3 text-indigo-500" />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
            {profile.nickname}
          </p>
          <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-indigo-50 dark:bg-indigo-900/40 px-2 py-0.5">
            <span className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-200">
              {profile.englishLevel}
            </span>
            {levelLabel && (
              <span className="text-[11px] text-gray-500 dark:text-gray-400">
                · 英语水平：{levelLabel}
              </span>
            )}
          </div>
        </div>
      </div>

      {onToggleTheme && (
        <button
          type="button"
          onClick={onToggleTheme}
          className="flex-shrink-0 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label={`切换到${theme === 'dark' ? '浅色' : '深色'}模式`}
          title="切换深浅模式"
        >
          {theme === 'dark' ? (
            <Sun className="h-4 w-4 text-yellow-400" />
          ) : (
            <Moon className="h-4 w-4 text-blue-500" />
          )}
        </button>
      )}
    </section>
  );
}
