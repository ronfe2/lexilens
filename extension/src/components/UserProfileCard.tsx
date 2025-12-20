import { Moon, Sun, User } from 'lucide-react';
import { getLevelConfig } from '../sidepanel/hooks/useUserProfile';
import type { UserProfile } from '../sidepanel/hooks/useUserProfile';
import type { Theme } from '../sidepanel/hooks/useTheme';

interface UserProfileCardProps {
  profile: UserProfile;
  className?: string;
  theme?: Theme;
  onToggleTheme?: () => void;
  onOpenProfile?: () => void;
  onLevelClick?: () => void;
}

export default function UserProfileCard({
  profile,
  className = '',
  theme = 'light',
  onToggleTheme,
  onOpenProfile,
  onLevelClick,
}: UserProfileCardProps) {
  const initial =
    (profile.nickname && profile.nickname.trim().charAt(0).toUpperCase()) || 'L';

  const levelConfig = getLevelConfig(profile.englishLevel);

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
          <button
            type="button"
            onClick={onLevelClick}
            className="mt-1 inline-flex items-center gap-1 rounded-full bg-indigo-50 dark:bg-indigo-900/40 px-2 py-0.5 hover:bg-indigo-100 dark:hover:bg-indigo-900/70 transition-colors"
            aria-label="调整英语等级"
          >
            <span className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-200">
              {levelConfig.label}
            </span>
            <span className="text-[11px] text-gray-500 dark:text-gray-400 truncate max-w-[9rem]">
              · {levelConfig.ability}
            </span>
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        {onOpenProfile && (
          <button
            type="button"
            onClick={onOpenProfile}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="打开个人信息页面"
            title="个人信息"
          >
            <User className="h-4 w-4 text-gray-600 dark:text-gray-300" />
          </button>
        )}

        {onToggleTheme && (
          <button
            type="button"
            onClick={onToggleTheme}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
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
      </div>
    </section>
  );
}
