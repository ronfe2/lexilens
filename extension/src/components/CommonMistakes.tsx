import { motion } from 'framer-motion';
import { XCircle, CheckCircle, AlertTriangle } from 'lucide-react';
import type { CommonMistake } from '../shared/types';

interface CommonMistakesProps {
  mistakes: CommonMistake[];
}

type DiffPartType = 'equal' | 'add' | 'remove';

interface DiffPart {
  text: string;
  type: DiffPartType;
}

interface DiffResult {
  wrongParts: DiffPart[];
  correctParts: DiffPart[];
}

// Very small word-level diff to highlight what changed between wrong/correct.
function diffSentencePair(wrong: string, correct: string): DiffResult {
  const a = wrong.split(/\s+/).filter(Boolean);
  const b = correct.split(/\s+/).filter(Boolean);
  const m = a.length;
  const n = b.length;

  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array.from({ length: n + 1 }, () => 0),
  );

  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const ops: DiffPart[] = [];
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      ops.push({ text: a[i - 1], type: 'equal' });
      i -= 1;
      j -= 1;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.push({ text: b[j - 1], type: 'add' });
      j -= 1;
    } else if (i > 0) {
      ops.push({ text: a[i - 1], type: 'remove' });
      i -= 1;
    }
  }

  ops.reverse();

  const wrongParts: DiffPart[] = [];
  const correctParts: DiffPart[] = [];

  for (const part of ops) {
    if (part.type === 'equal') {
      wrongParts.push({ text: part.text, type: 'equal' });
      correctParts.push({ text: part.text, type: 'equal' });
    } else if (part.type === 'remove') {
      wrongParts.push({ text: part.text, type: 'remove' });
    } else if (part.type === 'add') {
      correctParts.push({ text: part.text, type: 'add' });
    }
  }

  return { wrongParts, correctParts };
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
        {mistakes.map((mistake, index) => {
          const { wrongParts, correctParts } = diffSentencePair(
            mistake.wrong,
            mistake.correct,
          );

          return (
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
                      {wrongParts.map((part, iPart) => {
                        const key = `${index}-w-${iPart}`;
                        if (part.type === 'remove') {
                          return (
                            <span
                              key={key}
                              className="line-through text-red-600 dark:text-red-400"
                            >
                              {part.text}{' '}
                            </span>
                          );
                        }
                        return (
                          <span key={key}>
                            {part.text}{' '}
                          </span>
                        );
                      })}
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
                      {correctParts.map((part, iPart) => {
                        const key = `${index}-c-${iPart}`;
                        if (part.type === 'add') {
                          return (
                            <span
                              key={key}
                              className="font-semibold text-green-700 dark:text-green-300"
                            >
                              {part.text}{' '}
                            </span>
                          );
                        }
                        return (
                          <span key={key}>
                            {part.text}{' '}
                          </span>
                        );
                      })}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.section>
  );
}
