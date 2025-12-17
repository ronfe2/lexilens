import { motion } from 'framer-motion';
import { Lightbulb, ArrowRight, Sparkles } from 'lucide-react';
import type { CognitiveScaffolding as CognitiveScaffoldingType } from '../shared/types';

interface CognitiveScaffoldingProps {
  data: CognitiveScaffoldingType;
}

const relationshipConfig = {
  synonym: { label: 'Similar', color: 'text-blue-600 dark:text-blue-400' },
  antonym: { label: 'Opposite', color: 'text-red-600 dark:text-red-400' },
  broader: { label: 'Broader', color: 'text-purple-600 dark:text-purple-400' },
  narrower: { label: 'Narrower', color: 'text-green-600 dark:text-green-400' },
};

export default function CognitiveScaffolding({ data }: CognitiveScaffoldingProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="px-6 py-4 pb-6"
    >
      <div className="flex items-center gap-2 mb-3">
        <Lightbulb className="h-4 w-4 text-amber-500" />
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Next Steps
        </h2>
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
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {data.personalizedTip}
            </p>
          </div>
        </motion.div>
      )}

      <div className="space-y-3">
        {data.relatedWords.map((related, index) => {
          const config = relationshipConfig[related.relationship];
          
          return (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 + index * 0.1 }}
              className="glass glass-border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg font-semibold text-gray-900 dark:text-white">
                  {related.word}
                </span>
                <span className={`text-xs font-medium ${config.color}`}>
                  {config.label}
                </span>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <ArrowRight className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
                  <p className="text-gray-700 dark:text-gray-300">
                    <span className="font-medium">Key difference:</span> {related.keyDifference}
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <ArrowRight className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
                  <p className="text-gray-700 dark:text-gray-300">
                    <span className="font-medium">When to use:</span> {related.whenToUse}
                  </p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.section>
  );
}
