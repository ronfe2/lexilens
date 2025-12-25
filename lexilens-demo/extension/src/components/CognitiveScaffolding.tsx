import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Lightbulb, ArrowRight } from 'lucide-react';
import type { CognitiveScaffolding as CognitiveScaffoldingType } from '../shared/types';
import { API_URL } from '../shared/constants';
import { createShortLabel, getLexicalBaseWord } from '../shared/utils';

interface CognitiveScaffoldingProps {
  data: CognitiveScaffoldingType;
  word: string;
  // When true, show a lightweight "loading" state even if relatedWords
  // have not arrived yet so the Lexical Map section is visible during
  // initial analysis.
  isLoading?: boolean;
  // When true, enable the async "warmup" request for the default demo
  // profile (Lexi Learner) so the image is ready before the user clicks.
  enableAsyncImageWarmup?: boolean;
  // Headwords the learner has explicitly marked as favorites; used to
  // prioritize default related nodes in the Lexical Map.
  favoriteWords?: string[];
  // Fired whenever the user successfully generates a Lexical Map image
  // for a given base/related word pair.
  onImageGenerated?: (params: {
    baseWord: string;
    relatedWord: string;
    imageUrl: string;
    prompt?: string;
  }) => void;
  // Fired once per headword whenever the Lexical Map view is shown so
  // callers can record an additional exposure toward mastery.
  onLexicalMapShown?: (word: string) => void;
}

interface LexicalImageResponse {
  image_url: string;
  prompt?: string;
}

type PrefetchStatus = 'idle' | 'loading' | 'success' | 'error';

const relationshipConfig = {
  synonym: { label: 'Similar', color: 'text-blue-600 dark:text-blue-400' },
  antonym: { label: 'Opposite', color: 'text-red-600 dark:text-red-400' },
  broader: { label: 'Broader', color: 'text-purple-600 dark:text-purple-400' },
  narrower: { label: 'Narrower', color: 'text-green-600 dark:text-green-400' },
  collocate: { label: 'Collocate', color: 'text-teal-600 dark:text-teal-400' },
} as const;

// Pick a default related word with the following priority:
// 1) Related words that are also in the user's favorite word list
//    (case-insensitive), smallest word in ascending alphabetical order.
// 2) Otherwise, fall back to the previous behavior:
//    a) "synonym" relationships first
//    b) Within that group (or all others when no synonym), smallest
//       word in ascending alphabetical order.
function selectPreferredRelatedIndex(
  relatedWords: CognitiveScaffoldingType['relatedWords'],
  maxCount: number,
  favoriteWords?: string[],
): number | null {
  if (!relatedWords || relatedWords.length === 0 || maxCount <= 0) {
    return null;
  }

  const available = relatedWords.slice(0, maxCount);

  const pickFrom = (items: { index: number; word: string }[]): number | null => {
    if (!items.length) return null;
    const sorted = [...items].sort((a, b) => a.word.localeCompare(b.word));
    return sorted[0]?.index ?? null;
  };

  const favoriteSet =
    favoriteWords && favoriteWords.length
      ? new Set(
          favoriteWords
            .map((w) =>
              typeof w === 'string' ? w.trim().toLowerCase() : '',
            )
            .filter((w) => w.length > 0),
        )
      : null;

  const normalized = available.map((rw, index) => ({
    index,
    relationship: rw.relationship,
    word: (rw.word ?? '').toString().toLowerCase(),
  }));

  if (favoriteSet && favoriteSet.size > 0) {
    const favoriteCandidates = normalized.filter((item) =>
      favoriteSet.has(item.word),
    );
    const favoriteIndex = pickFrom(favoriteCandidates);
    if (favoriteIndex !== null) {
      return favoriteIndex;
    }
  }

  const synonymCandidates = normalized.filter((item) => item.relationship === 'synonym');
  const synonymIndex = pickFrom(synonymCandidates);
  if (synonymIndex !== null) {
    return synonymIndex;
  }

  return pickFrom(normalized);
}

async function fetchLexicalImage(
  baseWord: string,
  relatedWord: string,
): Promise<LexicalImageResponse> {
  const resp = await fetch(`${API_URL}/api/lexical-map/image`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      base_word: baseWord,
      related_word: relatedWord,
    }),
  });

  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status}`);
  }

  const json: LexicalImageResponse = await resp.json();
  return json;
}

export default function CognitiveScaffolding({
  data,
  word,
  isLoading = false,
  enableAsyncImageWarmup = false,
  favoriteWords,
  onImageGenerated,
  onLexicalMapShown,
}: CognitiveScaffoldingProps) {
  const rawBaseWord = word || 'Word';
  const displayBaseWord = getLexicalBaseWord(rawBaseWord) || rawBaseWord;

  const size = 220;
  const center = size / 2;
  const positions = [
    { x: center - 80, y: center - 40 },
    { x: center + 80, y: center + 40 },
    { x: center - 80, y: center + 40 },
    { x: center + 80, y: center - 40 },
  ];

  // Backend may eventually return up to 5 related words, but the current
  // UI only has room for 4 nodes. Always slice to the visible positions so
  // we keep the layout stable even as the underlying API evolves.
  const visibleRelatedWords =
    Array.isArray(data.relatedWords) && data.relatedWords.length > 0
      ? data.relatedWords.slice(0, positions.length)
      : [];

  const hasRelatedWords = visibleRelatedWords.length > 0;

  const graphNodes = visibleRelatedWords.map((related, index) => ({
    related,
    x: positions[index].x,
    y: positions[index].y,
    // Use a concise label so long phrases/sentences do not blow up node size.
    label: createShortLabel(related.word, { maxWords: 4, maxChars: 32 }),
  }));

  // When Lexical Map is running in a candidate-first mode, the frontend may
  // initially receive only `word`/`relationship` without detailed text.
  const hasAnyEnrichedDetails = visibleRelatedWords.some((related) => {
    const diff = (related.keyDifference ?? '').trim();
    const when = (related.whenToUse ?? '').trim();
    return diff.length > 0 || when.length > 0;
  });

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'text' | 'image'>('text');
  const [imageState, setImageState] = useState<{
    url: string | null;
    isLoading: boolean;
    error: string | null;
    baseWord: string | null;
    relatedWord: string | null;
  }>({
    url: null,
    isLoading: false,
    error: null,
    baseWord: null,
    relatedWord: null,
  });

  const selectedRelated =
    selectedIndex !== null ? visibleRelatedWords[selectedIndex] : null;

  // Internal refs for managing the hidden warmup request.
  const prefetchKeyRef = useRef<string | null>(null);
  const prefetchStatusRef = useRef<PrefetchStatus>('idle');
  const prefetchResultRef = useRef<LexicalImageResponse | null>(null);
  const usingPrefetchRef = useRef(false);
  const userClickedRef = useRef(false);
  const delayTimerRef = useRef<number | null>(null);

  // Warm up the lexical image request in the background for the default
  // demo profile (Lexi Learner). This uses the priority rules:
  // 1) Favor related words that are marked as favorites by the learner.
  // 2) Otherwise, "synonym" relationship first.
  // 3) Alphabetical order within the candidate group.
  useEffect(() => {
    if (!enableAsyncImageWarmup) return;
    if (!visibleRelatedWords || visibleRelatedWords.length === 0) return;

    const preferredIndex = selectPreferredRelatedIndex(
      visibleRelatedWords,
      positions.length,
      favoriteWords,
    );
    if (preferredIndex === null) return;

    const preferred = visibleRelatedWords[preferredIndex];
    if (!preferred || !preferred.word) return;

    const baseWord = displayBaseWord;
    const relatedWord = preferred.word;
    const prefetchKey = `${baseWord}:::${relatedWord}`.toLowerCase();

    // Avoid duplicate warmup requests for the same pair.
    if (
      prefetchKeyRef.current === prefetchKey &&
      prefetchStatusRef.current !== 'idle'
    ) {
      return;
    }

    prefetchKeyRef.current = prefetchKey;
    prefetchStatusRef.current = 'loading';
    prefetchResultRef.current = null;

    // Fire-and-forget warmup request; any UI updates are gated by whether
    // the user has interacted with the "generate image" button.
    void (async () => {
      try {
        const json = await fetchLexicalImage(baseWord, relatedWord);

        // If another warmup has started in the meantime, ignore this result.
        if (prefetchKeyRef.current !== prefetchKey) {
          return;
        }

        prefetchStatusRef.current = 'success';
        prefetchResultRef.current = json;

        // If the user already clicked while warmup was in-flight and we are
        // relying on this warmup request (instead of sending a second one),
        // show the image immediately once it is ready.
        if (
          usingPrefetchRef.current &&
          userClickedRef.current &&
          !delayTimerRef.current
        ) {
          setImageState((prev) => ({
            ...prev,
            url: json.image_url,
            isLoading: false,
            error: null,
          }));

          if (json.image_url) {
            onImageGenerated?.({
              baseWord,
              relatedWord,
              imageUrl: json.image_url,
              prompt: json.prompt,
            });
          }
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Lexical image warmup failed', err);

        if (prefetchKeyRef.current !== prefetchKey) {
          return;
        }

        prefetchStatusRef.current = 'error';
        prefetchResultRef.current = null;

        // If the user is already waiting on this warmup request, surface an
        // error but continue to keep the "text" explanation available.
        if (
          usingPrefetchRef.current &&
          userClickedRef.current &&
          !delayTimerRef.current
        ) {
          setImageState((prev) => ({
            ...prev,
            isLoading: false,
            error: '漫画生成失败，请稍后再试。',
          }));
          setViewMode('text');
        }
      }
    })();
    // We intentionally depend on the raw `data.relatedWords` object here
    // instead of the derived `visibleRelatedWords` slice so the warmup
    // effect only runs when the backend payload actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    enableAsyncImageWarmup,
    data.relatedWords,
    displayBaseWord,
    positions.length,
    favoriteWords,
    onImageGenerated,
  ]);

  // Fire a one-time exposure callback whenever the Lexical Map is shown
  // for a new headword so the wordbook can increment mastery.
  const lastExposureWordRef = useRef<string | null>(null);

  useEffect(() => {
    if (!onLexicalMapShown) return;
    const normalized = (word ?? '').trim();
    if (!normalized) return;
    const lowered = normalized.toLowerCase();
    if (lastExposureWordRef.current === lowered) return;
    lastExposureWordRef.current = lowered;
    onLexicalMapShown(normalized);
  }, [onLexicalMapShown, word]);

  // Reset image state whenever the selected node or base word changes.
  useEffect(() => {
    setViewMode('text');
    userClickedRef.current = false;
    usingPrefetchRef.current = false;
    if (delayTimerRef.current != null) {
      window.clearTimeout(delayTimerRef.current);
      delayTimerRef.current = null;
    }

    setImageState({
      url: null,
      isLoading: false,
      error: null,
      baseWord: null,
      relatedWord: null,
    });
  }, [selectedIndex, word]);

  useEffect(
    () => () => {
      // Cleanup any pending artificial delay timers on unmount.
      if (delayTimerRef.current != null) {
        window.clearTimeout(delayTimerRef.current);
        delayTimerRef.current = null;
      }
    },
    [],
  );

  const handleGenerateImage = async () => {
    if (selectedIndex === null) return;

    const related = selectedRelated;
    if (!related) return;

    const base = displayBaseWord;
    setViewMode('image');
    userClickedRef.current = true;

    const relatedWord = related.word;
    const requestKey = `${base}:::${relatedWord}`.toLowerCase();
    const hasMatchingWarmup =
      enableAsyncImageWarmup &&
      prefetchKeyRef.current === requestKey &&
      prefetchStatusRef.current !== 'idle';

    // Always show the loading state while the user waits.
    setImageState({
      url: null,
      isLoading: true,
      error: null,
      baseWord: base,
      relatedWord,
    });

    // 1) Warmup already finished for this pair: fake a short delay so it still
    //    feels like a live request.
    if (
      hasMatchingWarmup &&
      prefetchStatusRef.current === 'success' &&
      prefetchResultRef.current?.image_url
    ) {
      usingPrefetchRef.current = true;

      const delayMs = 1000 + Math.floor(Math.random() * 4000);
      const timerId = window.setTimeout(() => {
        // Only apply the prefetched result if nothing else has superseded it.
        if (
          usingPrefetchRef.current &&
          prefetchKeyRef.current === requestKey &&
          prefetchStatusRef.current === 'success' &&
          prefetchResultRef.current?.image_url
        ) {
          const imageUrl = prefetchResultRef.current.image_url;
          const prompt = prefetchResultRef.current.prompt;

          setImageState((prev) => ({
            ...prev,
            url: imageUrl,
            isLoading: false,
            error: null,
          }));

          onImageGenerated?.({
            baseWord: base,
            relatedWord,
            imageUrl,
            prompt,
          });
        }
        delayTimerRef.current = null;
      }, delayMs);

      delayTimerRef.current = timerId;
      return;
    }

    // 2) Warmup is in-flight for this pair: do not send another request.
    if (hasMatchingWarmup && prefetchStatusRef.current === 'loading') {
      usingPrefetchRef.current = true;
      return;
    }

    // 3) No usable warmup available – fall back to a normal request.
    usingPrefetchRef.current = false;

    try {
      const json = await fetchLexicalImage(base, relatedWord);

      setImageState((prev) => ({
        ...prev,
        url: json.image_url,
        isLoading: false,
        error: null,
      }));

      if (json.image_url) {
        onImageGenerated?.({
          baseWord: base,
          relatedWord,
          imageUrl: json.image_url,
          prompt: json.prompt,
        });
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Lexical image generation failed', err);
      setImageState((prev) => ({
        ...prev,
        isLoading: false,
        error: '漫画生成失败，请稍后再试。',
      }));
      // Fall back to text view if image fails
      setViewMode('text');
    }
  };

  const handleShowText = () => {
    setViewMode('text');
  };

  const handleShowImage = () => {
    // Only switch view; actual generation is triggered explicitly via the CTA.
    setViewMode('image');
  };

  const [isImageModalOpen, setIsImageModalOpen] = useState(false);

  return (
    <>
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="px-6 py-4 pb-6 space-y-4"
      >
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-amber-500" />
          <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            LEXICAL MAP
          </h2>
        </div>

        <div>
          <div className="relative h-56 glass glass-border rounded-2xl overflow-hidden">
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              viewBox={`0 0 ${size} ${size}`}
              preserveAspectRatio="none"
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
                className="px-4 py-2 rounded-full bg-primary-500/90 text-white text-sm font-semibold shadow-lg max-w-[220px]"
              >
                <div className="flex items-center justify-center gap-2">
                  <span className="text-center truncate">{displayBaseWord}</span>
                  {isLoading && (
                    <span className="inline-flex h-3 w-3 rounded-full border-2 border-white/70 border-t-transparent animate-spin" />
                  )}
                </div>
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
                      // Use percentage-based positioning so nodes stay
                      // aligned with the SVG lines even when the container
                      // is resized, avoiding the misalignment between nodes
                      // and edges that can happen with fixed pixel offsets.
                      left: `${(node.x / size) * 100}%`,
                      top: `${(node.y / size) * 100}%`,
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
                      {node.label}
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

        <div className="space-y-3">
          {selectedIndex === null ? (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {!hasRelatedWords && isLoading ? (
                <>
                  正在为{' '}
                  <span className="font-semibold">{displayBaseWord}</span>{' '}
                  构建词汇地图，很快就会出现和它关系最紧密的几个节点…
                </>
              ) : !hasRelatedWords ? (
                <>
                  目前暂时没有为{' '}
                  <span className="font-semibold">{displayBaseWord}</span>{' '}
                  找到合适的相关词，可以稍后再试一次或换一个单词。
                </>
              ) : hasAnyEnrichedDetails ? (
                <>
                  点击上面的词汇节点，查看与{' '}
                  <span className="font-semibold">{displayBaseWord}</span>{' '}
                  的关键区别和典型使用场景。
                </>
              ) : (
                <>
                  词汇地图已经为你找到了和{' '}
                  <span className="font-semibold">{displayBaseWord}</span>{' '}
                  关系最紧密的几个词。点击某个节点加载详细区别。
                </>
              )}
            </p>
          ) : (
            (() => {
              const related = selectedRelated;
              if (!related) {
                return null;
              }
              const config = relationshipConfig[related.relationship];
              const keyDifference = (related.keyDifference ?? '').trim();
              const whenToUse = (related.whenToUse ?? '').trim();
              const hasTextDetails = keyDifference.length > 0 || whenToUse.length > 0;

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

                  <div className="mb-3 inline-flex rounded-full bg-gray-100 p-1 text-[11px] dark:bg-gray-800">
                    <button
                      type="button"
                      onClick={handleShowText}
                      className={`px-3 py-1 rounded-full transition-colors ${
                        viewMode === 'text'
                          ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-gray-50'
                          : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
                      }`}
                    >
                      文字解释
                    </button>
                    <button
                      type="button"
                      onClick={handleShowImage}
                      className={`px-3 py-1 rounded-full transition-colors ${
                        viewMode === 'image'
                          ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-gray-50'
                          : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
                      }`}
                    >
                      漫画解释
                    </button>
                  </div>

                  <div className="space-y-3 text-sm">
                    {viewMode === 'image' ? (
                      imageState.isLoading ? (
                        <div className="flex items-center justify-center py-8 text-xs text-gray-500 dark:text-gray-400">
                          正在绘制漫画解释...
                        </div>
                      ) : imageState.url ? (
                        <div className="mt-1 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-gray-900/60">
                          <img
                            src={imageState.url}
                            alt={`Visual explanation of the difference between ${displayBaseWord} and ${related.word}`}
                            className="w-full h-auto object-contain cursor-zoom-in"
                            onClick={() => {
                              if (!imageState.url) return;

                              try {
                                chrome.runtime.sendMessage(
                                  {
                                    type: 'LEXILENS_SHOW_LEXICAL_IMAGE',
                                    imageUrl: imageState.url,
                                  },
                                  (response) => {
                                    const lastError = chrome.runtime.lastError;
                                    if (lastError || !response || response.success !== true) {
                                      // Fallback: show zoomed image inside side panel if we
                                      // cannot reach the content script for a full-page overlay.
                                      setIsImageModalOpen(true);
                                    }
                                  },
                                );
                              } catch {
                                setIsImageModalOpen(true);
                              }
                            }}
                          />
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-6 text-xs text-gray-500 dark:text-gray-400">
                          <p className="mb-3 text-center">
                            点击下方按钮，为这对词汇绘制一张 XKCD 风格的漫画解释。
                          </p>
                          <button
                            type="button"
                            onClick={handleGenerateImage}
                            disabled={imageState.isLoading}
                            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-full bg-primary-50 text-primary-700 hover:bg-primary-100 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-primary-900/30 dark:text-primary-200 dark:hover:bg-primary-900/60"
                          >
                            {imageState.isLoading ? '正在绘制漫画…' : '绘制漫画'}
                          </button>
                        </div>
                      )
                    ) : (
                      hasTextDetails ? (
                        <>
                          {keyDifference && (
                            <div className="flex items-start gap-2">
                              <ArrowRight className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
                              <p className="text-gray-700 dark:text-gray-300">
                                <span className="font-medium text-gray-900 dark:text-gray-100">
                                  关键区别：
                                </span>{' '}
                                {keyDifference}
                              </p>
                            </div>
                          )}
                          {whenToUse && (
                            <div className="flex items-start gap-2">
                              <ArrowRight className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
                              <p className="text-gray-700 dark:text-gray-300">
                                <span className="font-medium text-gray-900 dark:text-gray-100">
                                  使用场景：
                                </span>{' '}
                                {whenToUse}
                              </p>
                            </div>
                          )}
                        </>
                      ) : (
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          详细解释正在生成中，很快就会为你补充这对词汇的区别和使用场景。
                        </p>
                      )
                    )}
                  </div>

                  {imageState.error && (
                    <p className="mt-2 text-[11px] text-red-500 dark:text-red-400">
                      {imageState.error}
                    </p>
                  )}
                </motion.div>
              );
            })()
          )}
        </div>
      </motion.section>

      {imageState.url && isImageModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setIsImageModalOpen(false)}
        >
          <div
            className="relative max-w-4xl w-full px-4"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="absolute -top-10 right-4 rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-gray-800 shadow hover:bg-white"
              onClick={() => setIsImageModalOpen(false)}
            >
              关闭
            </button>
            <img
              src={imageState.url}
              alt={`Visual explanation of the difference between ${imageState.baseWord ?? displayBaseWord} and ${imageState.relatedWord ?? ''}`}
              className="max-h-[80vh] w-full rounded-lg object-contain shadow-xl"
            />
          </div>
        </div>
      )}
    </>
  );
}
