import { motion } from 'framer-motion';
import { XCircle, CheckCircle, AlertTriangle } from 'lucide-react';
import type { CommonMistake } from '../shared/types';

interface CommonMistakesProps {
  mistakes: CommonMistake[];
}

export default function CommonMistakes({ mistakes }: CommonMistakesProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="px-6 py-4"
    >
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Common Mistakes
        </h2>
      </div>
      
      <div className="space-y-4">
        {mistakes.map((mistake, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 + index * 0.1 }}
            className="glass glass-border rounded-lg p-4 space-y-3"
          >
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
              <div className="flex items-start gap-2">
                <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs font-semibold text-red-700 dark:text-red-400 mb-1">
                    Wrong
                  </p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    {mistake.wrong}
                  </p>
                </div>
              </div>
            </div>

            <div className="px-3">
              <p className="text-xs text-gray-600 dark:text-gray-400 italic">
                {mistake.why}
              </p>
            </div>

            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md p-3">
              <div className="flex items-start gap-2">
                <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs font-semibold text-green-700 dark:text-green-400 mb-1">
                    Correct
                  </p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    {mistake.correct}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
}
