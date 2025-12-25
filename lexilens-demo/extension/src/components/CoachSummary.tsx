import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { getLevelConfig } from '../sidepanel/hooks/useUserProfile';
import type { UserProfile } from '../sidepanel/hooks/useUserProfile';
import { isLongEntry } from '../shared/utils';

interface CoachSummaryProps {
  word: string;
  personalizedTip?: string;
  profile: UserProfile;
  // Optional hint that the personalized 解读 is still being generated.
  // When true and `personalizedTip` is missing, a lightweight skeleton
  // card is shown instead of hiding the section entirely.
  isLoading?: boolean;
}

export default function CoachSummary({
  word,
  personalizedTip,
  profile,
  isLoading = false,
}: CoachSummaryProps) {
  // If there is no personalized 解读 yet and nothing is currently loading,
  // avoid rendering the section to keep the layout clean (e.g. saved entries
  // without a Layer 4 summary).
  if (!personalizedTip && !isLoading) {
    return null;
  }

  const levelConfig = getLevelConfig(profile.englishLevel);
  const levelDisplay = levelConfig.label;

  const targetLabel = isLongEntry(word) ? '这句话' : word;

  // While the personalized 解读 is still loading, show a compact skeleton so
  // the user knows this section is on the way without blocking the rest of
  // the coaching experience.
  if (!personalizedTip && isLoading) {
    return (
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="px-6 py-4"
      >
        <div className="glass glass-border rounded-xl p-4 flex gap-3">
          <div className="mt-0.5">
            <Sparkles className="h-5 w-5 text-primary-500" />
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              解读
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              正在为你整理解读{' '}
              <span className="font-semibold text-gray-800 dark:text-gray-100">
                {targetLabel}
              </span>
              ，稍后会结合你的水平和兴趣给出一段中文解释。
            </p>
            <div className="space-y-2 mt-1">
              <div className="h-3 w-4/5 rounded bg-gray-200 dark:bg-gray-800 animate-pulse" />
              <div className="h-3 w-3/5 rounded bg-gray-200 dark:bg-gray-800 animate-pulse" />
            </div>
          </div>
        </div>
      </motion.section>
    );
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="px-6 py-4"
    >
      <div className="glass glass-border rounded-xl p-4 flex gap-3">
        <div className="mt-0.5">
          <Sparkles className="h-5 w-5 text-primary-500" />
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            解读
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            以你目前的{' '}
            <span
              className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${levelConfig.badgeClassName}`}
            >
              {levelDisplay}
            </span>{' '}
            水平，下面会结合你日常会遇到的场景和内容偏好，来解读{' '}
            <span className="font-semibold text-gray-800 dark:text-gray-100">
              {targetLabel}
            </span>{' '}
            的用法和感觉：
          </p>
          <p className="text-sm leading-relaxed text-gray-800 dark:text-gray-200">
            {personalizedTip}
          </p>
        </div>
      </div>
    </motion.section>
  );
}
