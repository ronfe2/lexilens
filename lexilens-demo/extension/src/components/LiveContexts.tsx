import { motion } from 'framer-motion';
import { Twitter, Newspaper, GraduationCap } from 'lucide-react';
import type { LiveContext } from '../shared/types';

interface LiveContextsProps {
  contexts: LiveContext[];
}

const sourceConfig = {
  twitter: {
    icon: Twitter,
    label: 'Social Media',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    iconColor: 'text-blue-500',
  },
  news: {
    icon: Newspaper,
    label: 'News',
    bgColor: 'bg-orange-50 dark:bg-orange-900/20',
    iconColor: 'text-orange-500',
  },
  academic: {
    icon: GraduationCap,
    label: 'Academic',
    bgColor: 'bg-purple-50 dark:bg-purple-900/20',
    iconColor: 'text-purple-500',
  },
};

function highlightWord(text: string, word: string): JSX.Element {
  const regex = new RegExp(`(${word})`, 'gi');
  const parts = text.split(regex);
  
  return (
    <>
      {parts.map((part, index) => 
        regex.test(part) ? (
          <mark
            key={index}
            className="bg-yellow-200 dark:bg-yellow-800 text-gray-900 dark:text-gray-100 px-1 rounded"
          >
            {part}
          </mark>
        ) : (
          <span key={index}>{part}</span>
        )
      )}
    </>
  );
}

export default function LiveContexts({ contexts }: LiveContextsProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="px-6 py-4"
    >
      <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
        Live Contexts
      </h2>
      <div className="space-y-3">
        {contexts.map((context, index) => {
          const config = sourceConfig[context.source];
          const Icon = config.icon;
          
          return (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + index * 0.1 }}
              className={`glass glass-border rounded-lg p-4 ${config.bgColor}`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`h-4 w-4 ${config.iconColor}`} />
                <span className={`text-xs font-medium ${config.iconColor}`}>
                  {config.label}
                </span>
              </div>
              <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                {highlightWord(context.text, context.highlightedWord)}
              </p>
            </motion.div>
          );
        })}
      </div>
    </motion.section>
  );
}
