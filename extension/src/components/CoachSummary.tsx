import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { getLevelConfig } from '../sidepanel/hooks/useUserProfile';
import type { UserProfile } from '../sidepanel/hooks/useUserProfile';
import { isLongEntry } from '../shared/utils';

interface CoachSummaryProps {
  word: string;
  personalizedTip?: string;
  profile: UserProfile;
}

export default function CoachSummary({
  word,
  personalizedTip,
  profile,
}: CoachSummaryProps) {
  if (!personalizedTip) {
    return null;
  }

  const levelConfig = getLevelConfig(profile.englishLevel);
  const levelDisplay = levelConfig.label;

  const targetLabel = isLongEntry(word) ? '这句话' : word;

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
