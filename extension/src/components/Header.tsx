import { motion } from 'framer-motion';
import { Volume2, X } from 'lucide-react';
import { useState } from 'react';

interface HeaderProps {
  word: string;
  pronunciation?: {
    ipa: string;
    audioUrl?: string;
  };
  onClose?: () => void;
}

export default function Header({ word, pronunciation, onClose }: HeaderProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  const playPronunciation = async () => {
    if (!pronunciation?.audioUrl) return;
    
    setIsPlaying(true);
    const audio = new Audio(pronunciation.audioUrl);
    audio.onended = () => setIsPlaying(false);
    audio.onerror = () => setIsPlaying(false);
    await audio.play();
  };

  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="sticky top-0 z-10 glass glass-border border-b px-6 py-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {word}
          </h1>
          {pronunciation && (
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                /{pronunciation.ipa}/
              </span>
              {pronunciation.audioUrl && (
                <button
                  onClick={playPronunciation}
                  disabled={isPlaying}
                  className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors disabled:opacity-50"
                  aria-label="Play pronunciation"
                >
                  <Volume2 className="h-4 w-4 text-primary-500" />
                </button>
              )}
            </div>
          )}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          </button>
        )}
      </div>
    </motion.header>
  );
}
