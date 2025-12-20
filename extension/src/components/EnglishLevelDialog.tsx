import { X } from 'lucide-react';
import { type EnglishLevel, getLevelConfig } from '../sidepanel/hooks/useUserProfile';

interface EnglishLevelDialogProps {
  isOpen: boolean;
  currentLevel: EnglishLevel;
  onSelect: (level: EnglishLevel) => void;
  onClose: () => void;
}

export default function EnglishLevelDialog({
  isOpen,
  currentLevel,
  onSelect,
  onClose,
}: EnglishLevelDialogProps) {
  if (!isOpen) return null;

  const levelsInOrder: EnglishLevel[] = [
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

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40"
      aria-modal="true"
      role="dialog"
    >
      <div className="max-h-[90vh] w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 shadow-xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-gray-800">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              选择你的英语等级
            </h2>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              用更贴近你水平的方式解释和举例。
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="关闭等级选择"
          >
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>

        <div className="px-4 py-3 overflow-y-auto space-y-2">
          {levelsInOrder.map((level) => {
            const config = getLevelConfig(level);
            const isActive = level === currentLevel;

            return (
              <button
                key={level}
                type="button"
                onClick={() => onSelect(level)}
                className={`w-full text-left rounded-xl border px-3.5 py-2.5 transition-colors ${
                  isActive
                    ? 'border-primary-500 bg-primary-50/70 dark:bg-primary-900/40'
                    : 'border-gray-200 hover:border-primary-300 hover:bg-gray-50 dark:border-gray-800 dark:hover:border-primary-700 dark:hover:bg-gray-900'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/40 px-2 py-0.5 text-[11px] font-semibold text-primary-700 dark:text-primary-200">
                      {config.label}
                    </span>
                    <span className="text-xs font-medium text-gray-800 dark:text-gray-100">
                      {config.ability}
                    </span>
                  </div>
                  {isActive && (
                    <span className="text-[11px] font-medium text-primary-600 dark:text-primary-300">
                      当前
                    </span>
                  )}
                </div>
                <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                  适合：{config.recommendation}
                </p>
              </button>
            );
          })}
        </div>

        <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-800 text-[11px] text-gray-500 dark:text-gray-400">
          之后你随时可以在这里调整等级，LexiLens 会自动调整讲解难度。
        </div>
      </div>
    </div>
  );
}
