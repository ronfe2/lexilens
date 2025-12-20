import { motion } from 'framer-motion';
import { BookmarkPlus, Volume2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { truncateText } from '../shared/utils';

interface HeaderProps {
  word: string;
  pronunciation?: {
    ipa: string;
    audioUrl?: string;
  };
  // Short Cobuild-style English explanation under the headword
  definition?: string;
  onAddToWordlistClick?: () => void;
  onClose?: () => void;
}

const MAX_DEFINITION_PREVIEW_LENGTH = 160;

export default function Header({
  word,
  pronunciation,
  definition,
  onAddToWordlistClick,
  onClose,
}: HeaderProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isDefinitionExpanded, setIsDefinitionExpanded] = useState(true);

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
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h1
            className="text-3xl font-bold text-gray-900 dark:text-white truncate"
            title={word}
          >
            {word}
          </h1>
          {pronunciation && (pronunciation.ipa || pronunciation.audioUrl) && (
            <div className="flex items-center gap-2 mt-1">
              {pronunciation.ipa && pronunciation.ipa !== 'N/A' && (
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  /{pronunciation.ipa}/
                </span>
              )}
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

          {definition && (
            <DefinitionBlock
              word={word}
              definition={definition}
              isExpanded={isDefinitionExpanded}
              onToggle={() => setIsDefinitionExpanded((prev) => !prev)}
            />
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onAddToWordlistClick}
            className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            aria-label="加入生词表"
            title="加入生词表（即将上线）"
          >
            <BookmarkPlus className="h-4 w-4 text-primary-500" />
          </button>
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
      </div>
    </motion.header>
  );
}

interface DefinitionBlockProps {
  word: string;
  definition: string;
  isExpanded: boolean;
  onToggle: () => void;
}

function DefinitionBlock({
  word,
  definition,
  isExpanded,
  onToggle,
}: DefinitionBlockProps) {
  const shouldCollapse = definition.length > MAX_DEFINITION_PREVIEW_LENGTH;
  const headwordRegex = useMemo(
    () => new RegExp(`(${word})`, 'gi'),
    [word],
  );

  const visibleText =
    !shouldCollapse || isExpanded
      ? definition
      : truncateText(definition, MAX_DEFINITION_PREVIEW_LENGTH);

  const parts = useMemo(() => {
    const segments: { text: string; isHeadword: boolean }[] = [];
    let lastIndex = 0;
    const text = visibleText;

    if (!text) return segments;

    let match: RegExpExecArray | null;
    const regex = new RegExp(headwordRegex.source, headwordRegex.flags);

    // Highlight occurrences of the headword (case-insensitive)
    while ((match = regex.exec(text)) != null) {
      const index = match.index;
      if (index > lastIndex) {
        segments.push({
          text: text.slice(lastIndex, index),
          isHeadword: false,
        });
      }
      segments.push({
        text: match[0],
        isHeadword: true,
      });
      lastIndex = index + match[0].length;
    }

    if (lastIndex < text.length) {
      segments.push({
        text: text.slice(lastIndex),
        isHeadword: false,
      });
    }

    if (!segments.length) {
      segments.push({ text, isHeadword: false });
    }

    return segments;
  }, [visibleText, headwordRegex]);

  return (
    <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
      <p className="text-sm leading-relaxed text-gray-800 dark:text-gray-200">
        {parts.map((part, index) =>
          part.isHeadword ? (
            <strong
              key={index}
              className="font-semibold text-gray-900 dark:text-white"
            >
              {part.text}
            </strong>
          ) : (
            <span key={index}>{part.text}</span>
          ),
        )}
      </p>
      {shouldCollapse && (
        <button
          type="button"
          onClick={onToggle}
          className="mt-1 text-[11px] text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
        >
          {isExpanded ? '收起' : '展开'}
        </button>
      )}
    </div>
  );
}
