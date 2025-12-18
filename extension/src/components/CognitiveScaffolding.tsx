import { useState } from 'react';
import { motion } from 'framer-motion';
import { Lightbulb, ArrowRight, Sparkles } from 'lucide-react';
import type { CognitiveScaffolding as CognitiveScaffoldingType } from '../shared/types';

interface CognitiveScaffoldingProps {
  data: CognitiveScaffoldingType;
  word: string;
}

const relationshipConfig = {
  synonym: { label: 'Similar', color: 'text-blue-600 dark:text-blue-400' },
  antonym: { label: 'Opposite', color: 'text-red-600 dark:text-red-400' },
  broader: { label: 'Broader', color: 'text-purple-600 dark:text-purple-400' },
  narrower: { label: 'Narrower', color: 'text-green-600 dark:text-green-400' },
};

export default function CognitiveScaffolding({ data, word }: CognitiveScaffoldingProps) {
  const baseWord = word || 'Word';

  const size = 220;
  const center = size / 2;
  const positions = [
    { x: center - 80, y: center - 40 },
    { x: center + 80, y: center + 40 },
    { x: center - 80, y: center + 40 },
    { x: center + 80, y: center - 40 },
  ];

  const graphNodes = data.relatedWords.slice(0, positions.length).map((related, index) => ({
    related,
    x: positions[index].x,
    y: positions[index].y,
  }));

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="px-6 py-4 pb-6 space-y-4"
    >
      <div className="flex items-center gap-2">
        <Lightbulb className="h-4 w-4 text-amber-500" />
        <div>
          <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Next Steps · 下一步练习
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            通过相关词汇建立联想记忆
          </p>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
          Lexical Map · 词汇地图
        </p>
        <div className="relative h-56 glass glass-border rounded-2xl overflow-hidden">
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox={`0 0 ${size} ${size}`}
          >
            {graphNodes.map((node, index) => (
              <line
                key={`line-${index}`}
                x1={center}
                y1={center}
                x2={node.x}
                y2={node.y}
                stroke="currentColor"
                className="text-primary-200 dark:text-primary-800"
                strokeWidth="1.5"
                strokeDasharray="4 3"
              />
            ))}
          </svg>

          <div className="absolute inset-0 flex items-center justify-center">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="px-4 py-2 rounded-full bg-primary-500/90 text-white text-sm font-semibold shadow-lg"
            >
              {baseWord}
            </motion.div>
          </div>

          {graphNodes.map((node, index) => {
            const config = relationshipConfig[node.related.relationship];
            const isSelected = selectedIndex === index;
            return (
              <motion.div
                key={`node-${index}`}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2 + index * 0.05 }}
                className="absolute"
                style={{
                  left: `${node.x}px`,
                  top: `${node.y}px`,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                <button
                  type="button"
                  onClick={() => setSelectedIndex(index)}
                  className={`px-3 py-2 rounded-full bg-white/80 dark:bg-gray-900/80 border shadow-sm backdrop-blur transition-all ${
                    isSelected
                      ? 'border-primary-400 dark:border-primary-500 shadow-md'
                      : 'border-white/40 dark:border-gray-700/40 hover:border-primary-300/80'
                  }`}
                >
                  <p className="text-xs font-semibold text-gray-900 dark:text-white">
                    {node.related.word}
                  </p>
                  <p className={`text-[10px] ${config?.color ?? 'text-gray-500'} mt-0.5`}>
                    {config?.label ?? node.related.relationship}
                  </p>
                </button>
              </motion.div>
            );
          })}
        </div>
      </div>

      {data.personalizedTip && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
          className="mb-4 bg-gradient-to-r from-primary-50 to-purple-50 dark:from-primary-900/20 dark:to-purple-900/20 border border-primary-200 dark:border-primary-800 rounded-lg p-4"
        >
          <div className="flex items-start gap-2">
            <Sparkles className="h-5 w-5 text-primary-500 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-xs font-semibold text-primary-700 dark:text-primary-300">
                个性化学习建议
              </p>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {data.personalizedTip}
              </p>
            </div>
          </div>
        </motion.div>
      )}

      <div className="space-y-3">
        {selectedIndex === null ? (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            点击上面的词汇节点，查看与 <span className="font-semibold">{baseWord}</span>{' '}
            的关键区别和典型使用场景。
          </p>
        ) : (
          (() => {
            const related = data.relatedWords[selectedIndex];
            if (!related) {
              return null;
            }
            const config = relationshipConfig[related.relationship];

            return (
              <motion.div
                key={related.word}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="glass glass-border rounded-lg p-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg font-semibold text-gray-900 dark:text-white">
                    {related.word}
                  </span>
                  {config && (
                    <span className={`text-xs font-medium ${config.color}`}>
                      {config.label}
                    </span>
                  )}
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex items-start gap-2">
                    <ArrowRight className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
                    <p className="text-gray-700 dark:text-gray-300">
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        关键区别：
                      </span>{' '}
                      {related.keyDifference}
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <ArrowRight className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
                    <p className="text-gray-700 dark:text-gray-300">
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        使用场景：
                      </span>{' '}
                      {related.whenToUse}
                    </p>
                  </div>
                </div>
              </motion.div>
            );
          })()
        )}
      </div>
    </motion.section>
  );
}
