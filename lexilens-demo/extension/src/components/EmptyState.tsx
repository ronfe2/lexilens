import { motion } from 'framer-motion';
import { BookOpen } from 'lucide-react';

export default function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center h-full p-8 text-center"
    >
      <motion.div
        animate={{ 
          y: [0, -10, 0],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      >
        <BookOpen className="h-20 w-20 text-primary-300 dark:text-primary-700 mb-6" />
      </motion.div>
      
      <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-4">
        LexiLens
      </h1>
      
      <p className="text-gray-600 dark:text-gray-400 max-w-md mb-2">
        Your real-time language coach
      </p>
      
      <p className="text-sm text-gray-500 dark:text-gray-500">
        Select a word on any webpage to start learning
      </p>
    </motion.div>
  );
}
