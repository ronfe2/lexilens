import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import type { UserProfile } from '../sidepanel/hooks/useUserProfile';

interface CoachSummaryProps {
  word: string;
  personalizedTip?: string;
  profile: UserProfile;
}

const levelLabels: Record<UserProfile['englishLevel'], string> = {
  A1: '入门',
  A2: '基础',
  B1: '中级',
  B2: '中高级',
  C1: '高级',
  C2: '接近母语',
};

export default function CoachSummary({
  word,
  personalizedTip,
  profile,
}: CoachSummaryProps) {
  if (!personalizedTip) {
    return null;
  }

  const levelLabel = levelLabels[profile.englishLevel] ?? '';
  const levelDisplay = levelLabel
    ? `${profile.englishLevel} · ${levelLabel}`
    : profile.englishLevel;

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
            <span className="font-semibold text-gray-800 dark:text-gray-100">
              {levelDisplay}
            </span>{' '}
            水平，下面结合你熟悉的场景（比如足球比赛、在北京买房或大模型相关的例子），来解读{' '}
            <span className="font-semibold text-gray-800 dark:text-gray-100">
              {word}
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
