import { motion } from 'framer-motion';
import { Quote } from 'lucide-react';
import type { BehaviorPattern as BehaviorPatternType } from '../shared/types';

interface BehaviorPatternProps {
  data: BehaviorPatternType;
}

export default function BehaviorPattern({ data }: BehaviorPatternProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="px-6 py-4"
    >
      <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
        Behavior Pattern
      </h2>
      <div className="glass glass-border rounded-lg p-4 relative">
        <Quote className="absolute top-3 right-3 h-8 w-8 text-primary-200 dark:text-primary-900" />
        <blockquote className="text-base leading-relaxed text-gray-800 dark:text-gray-200 relative z-10">
          {data.definition}
        </blockquote>
      </div>
    </motion.section>
  );
}
