import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import Header from '../components/Header';
import CommonMistakes from '../components/CommonMistakes';
import CognitiveScaffolding from '../components/CognitiveScaffolding';
import CoachSummary from '../components/CoachSummary';
import EmptyState from '../components/EmptyState';
import ErrorDisplay from '../components/ErrorDisplay';
import LoadingSpinner from '../components/LoadingSpinner';
import UserProfileCard from '../components/UserProfileCard';
import { useAppStore } from '../store/appStore';
import { useStreamingAnalysis } from './hooks/useStreamingAnalysis';
import { useLearningHistory } from './hooks/useLearningHistory';
import { useWordbook } from './hooks/useWordbook';
import { useAnalysisPersistence } from './hooks/useAnalysisPersistence';
import { useTheme } from './hooks/useTheme';
import { useUserProfile, getCefrForPrompt } from './hooks/useUserProfile';
import { useInterests } from './hooks/useInterests';
import EnglishLevelDialog from '../components/EnglishLevelDialog';
import ProfilePage from './ProfilePage';
import { API_URL } from '../shared/constants';
import type { AnalysisRequest, InterestLink, InterestTopic } from '../shared/types';

function App() {
  const { currentWord, analysisResult, isLoading, error, reset } = useAppStore();
  const { words: learningWords, addEntry } = useLearningHistory();
  const wordbook = useWordbook();
  const { onAnalysisComplete } = useAnalysisPersistence({
    upsertEntryFromAnalysis: wordbook.upsertEntryFromAnalysis,
    incrementStageForWord: wordbook.incrementStageForWord,
  });
  const { startAnalysis } = useStreamingAnalysis({ onAnalysisComplete });
  const { theme, toggleTheme } = useTheme();
  const { profile, updateProfile } = useUserProfile();
  const interests = useInterests();
  const { topics, blockedTitles, addOrUpdateFromServer } = interests;

  const favoriteWords = wordbook.entries
    .filter((entry) => entry.isFavorite)
    .map((entry) => entry.word)
    .filter((word) => typeof word === 'string' && word.trim().length > 0);

  const [view, setView] = useState<'coach' | 'profile' | 'saved-entry'>('coach');
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null);
  const [isLevelDialogOpen, setIsLevelDialogOpen] = useState(false);

  const lastSelectionRef = useRef<AnalysisRequest | null>(null);

  const updateInterestsFromUsage = useCallback(
    (request: AnalysisRequest) => {
      // Require a URL so we can attach it as a concrete example; if missing,
      // skip interest summarization for this usage.
      if (!request.url) return;

      const existingTopics = topics.map((topic) => ({
        id: topic.id,
        title: topic.title,
        summary: topic.summary,
        urls: topic.links.map((link) => link.url),
      }));

      // Fire-and-forget call to the interests API; this should never block
      // the main analysis flow.
      (async () => {
        try {
          const resp = await fetch(`${API_URL}/api/interests/from-usage`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              word: request.word,
              context: request.context,
              page_type: request.pageType,
              url: request.url,
              existing_topics: existingTopics,
              blocked_titles: blockedTitles,
            }),
          });

          if (!resp.ok) {
            // eslint-disable-next-line no-console
            console.warn(
              '[LexiLens] Failed to update interests from usage',
              resp.status,
            );
            return;
          }

          const json = await resp.json();
          const rawTopics = Array.isArray(json?.topics) ? json.topics : [];

          const now = Date.now();
          const currentById = new Map<string, InterestTopic>(
            topics.map((topic) => [topic.id, topic]),
          );

          const mappedTopics: InterestTopic[] = [];

          for (const raw of rawTopics as any[]) {
            if (!raw || typeof raw !== 'object') continue;

            const rawId =
              typeof raw.id === 'string' && raw.id.trim().length > 0
                ? (raw.id as string).trim()
                : '';
            const rawTitle =
              typeof raw.title === 'string' && raw.title.trim().length > 0
                ? (raw.title as string).trim()
                : '';

            if (!rawTitle) continue;

            const id =
              rawId || rawTitle.toLowerCase().replace(/\s+/g, '-');

            const summary =
              typeof raw.summary === 'string' && raw.summary.trim().length > 0
                ? (raw.summary as string).trim()
                : '';

            const urls = (Array.isArray((raw as any).urls)
              ? (raw as any).urls
              : []
            )
              .map((u: unknown) => (typeof u === 'string' ? u.trim() : ''))
              .filter((u: string): u is string => u.length > 0);

            const existing = currentById.get(id);
            const existingLinks = existing?.links ?? [];

            const normalizedExistingLinks: InterestLink[] = existingLinks.filter(
              (link) =>
                link &&
                typeof link.url === 'string' &&
                link.url.trim().length > 0,
            );

            const seenUrls = new Set(
              normalizedExistingLinks.map((link) => link.url),
            );

            const newLinks: InterestLink[] = [];
            for (const url of urls) {
              if (seenUrls.has(url)) continue;
              newLinks.push({
                url,
                title: undefined,
                lastUsedAt: now,
              });
            }

            const links = [...newLinks, ...normalizedExistingLinks];

            mappedTopics.push({
              id,
              title: rawTitle,
              summary,
              links,
              createdAt: existing?.createdAt ?? now,
              updatedAt: now,
            });
          }

          if (!mappedTopics.length) {
            return;
          }

          addOrUpdateFromServer(mappedTopics);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn(
            '[LexiLens] Failed to summarize interests from usage',
            err,
          );
        }
      })();
    },
    [topics, blockedTitles, addOrUpdateFromServer],
  );

  const handleSelection = useCallback(
    (data: any) => {
      if (!data?.word || !data?.context) return;

      const normalizedWord = String(data.word).trim();
      const normalizedContext = String(data.context).trim();

      // Ignore duplicate selections with the same word and context to avoid
      // hammering the backend (and the external pronunciation API) when some
      // pages emit multiple selection events for a single user action.
      const last = lastSelectionRef.current;
      if (last && last.word === normalizedWord && last.context === normalizedContext) {
        return;
      }

      const request: AnalysisRequest = {
        word: normalizedWord,
        context: normalizedContext,
        pageType: data.pageType,
        learningHistory: learningWords,
        // Map UI level (e.g. "Starter", "KET") to a CEFR-style hint for the backend prompt.
        englishLevel: getCefrForPrompt(profile.englishLevel),
        url: data.url,
        interests: topics,
        blockedTitles,
        favoriteWords,
      };

      lastSelectionRef.current = request;

      // Whenever a new selection comes in with explicit LexiLens intent
      // (e.g. floating button click or context menu), ensure the main
      // coach view is visible so the user can see the explanation.
      setView('coach');

      // Record into learning history for personalization
      addEntry({
        word: data.word,
        context: data.context,
        timestamp: Date.now(),
      });

      // Explicit LexiLens triggers (context menu, floating button under
      // selection, or restored selection from background) should start
      // analysis immediately.
      void startAnalysis(request);
      updateInterestsFromUsage(request);
    },
    [
      learningWords,
      addEntry,
      startAnalysis,
      profile.englishLevel,
      topics,
      blockedTitles,
      favoriteWords,
      updateInterestsFromUsage,
    ],
  );

  useEffect(() => {
    console.log('LexiLens sidepanel loaded');

    // Ask background for the last selected word when side panel opens
    chrome.runtime.sendMessage({ type: 'SIDE_PANEL_READY' }, (response) => {
      if (chrome.runtime.lastError) {
        // Side panel might open without background ready; fail silently
        return;
      }

      if (response?.selection) {
        // When the side panel is opened with a remembered selection
        // (e.g. via context menu), immediately start analysis once.
        handleSelection(response.selection);
      }
    });

    // Listen for live selection events while side panel stays open
    const listener = (message: any) => {
      if (message?.type === 'WORD_SELECTED') {
        handleSelection(message.data);
      }
    };

    chrome.runtime.onMessage.addListener(listener);

    return () => {
      chrome.runtime.onMessage.removeListener(listener);
    };
  }, [handleSelection]);

  const handleRetry = () => {
    reset();
    if (lastSelectionRef.current) {
      void startAnalysis(lastSelectionRef.current);
    }
  };

  const handleOpenSavedEntryLink = useCallback((url?: string) => {
    if (!url || typeof url !== 'string') return;

    try {
      chrome.runtime.sendMessage(
        { type: 'LEXILENS_OPEN_SAVED_ENTRY_URL', url },
        (response) => {
          const lastError = chrome.runtime.lastError;
          if (lastError || !response || response.success !== true) {
            try {
              chrome.tabs?.create({ url });
            } catch {
              // If even this fails, there is not much we can do – fail silently.
            }
          }
        },
      );
    } catch {
      try {
        chrome.tabs?.create({ url });
      } catch {
        // Ignore – opening the tab is a convenience, not critical path.
      }
    }
  }, []);

  const hasAnalysis =
    !!analysisResult?.layer1 ||
    !!analysisResult?.layer3 ||
    !!analysisResult?.layer4;

  const activeWord = analysisResult?.word || currentWord || '';
  const normalizedActiveWord = activeWord.trim();

  const isActiveWordFavorite =
    !!normalizedActiveWord &&
    wordbook.entries.some(
      (entry) =>
        entry.isFavorite &&
        entry.word.toLowerCase() === normalizedActiveWord.toLowerCase(),
    );

  const activeSavedEntry =
    view === 'saved-entry' && activeEntryId
      ? wordbook.entries.find((entry) => entry.id === activeEntryId)
      : undefined;

  const activeSnapshot = activeSavedEntry?.latestSnapshot;
  const savedAnalysis = activeSnapshot?.analysis;
  const savedWord =
    savedAnalysis?.word || activeSavedEntry?.word || '';
  const normalizedSavedWord = savedWord.trim();

  const isSavedWordFavorite =
    !!normalizedSavedWord &&
    wordbook.entries.some(
      (entry) =>
        entry.isFavorite &&
        entry.word.toLowerCase() === normalizedSavedWord.toLowerCase(),
    );

  let mainContent: ReactNode;

  if (view === 'profile') {
    mainContent = (
      <div className="flex-1 overflow-y-auto">
        <ProfilePage
          profile={profile}
          onUpdateProfile={updateProfile}
          onBack={() => setView('coach')}
          onLevelClick={() => setIsLevelDialogOpen(true)}
          interests={interests}
          wordbook={wordbook}
          onOpenWordbookEntry={(id) => {
            setActiveEntryId(id);
            setView('saved-entry');
          }}
          activeEntryId={activeEntryId}
        />
      </div>
    );
  } else if (view === 'saved-entry') {
    mainContent = (
      <>
        {activeSnapshot?.request.url && (
          <div className="px-6 pb-2">
            <div className="glass glass-border rounded-lg px-3 py-2 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  来自：
                  {(() => {
                    try {
                      const url = new URL(activeSnapshot.request.url as string);
                      return url.hostname;
                    } catch {
                      return activeSnapshot.request.url;
                    }
                  })()}
                </p>
                {activeSnapshot.request.context && (
                  <p className="text-[11px] text-gray-600 dark:text-gray-300 line-clamp-1">
                    {activeSnapshot.request.context}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleOpenSavedEntryLink(activeSnapshot.request.url)}
                className="flex-shrink-0 inline-flex items-center justify-center rounded-full border border-primary-500 px-3 py-1.5 text-[11px] font-medium text-primary-600 hover:bg-primary-50 dark:border-primary-400 dark:text-primary-200 dark:hover:bg-primary-900/40"
              >
                打开原文链接
              </button>
            </div>
          </div>
        )}

        <Header
          word={savedWord}
          pronunciation={savedAnalysis?.pronunciation}
          definition={savedAnalysis?.layer1?.definition}
          isFavorite={isSavedWordFavorite}
          onAddToWordlistClick={
            normalizedSavedWord
              ? () => wordbook.toggleFavoriteByWord(normalizedSavedWord)
              : undefined
          }
        />

        <div className="flex-1 overflow-y-auto space-y-1 pb-4">
          {!savedAnalysis ? (
            <div className="px-6 pt-4 text-xs text-gray-500 dark:text-gray-400">
              没有找到该单词的完整解释快照，可以在网页中重新选中该单词并运行一次 LexiLens。
            </div>
          ) : (
            <>
              <CoachSummary
                word={savedWord}
                personalizedTip={savedAnalysis.layer4?.personalizedTip}
                profile={profile}
              />

              {savedAnalysis.layer4 && (
                <CognitiveScaffolding
                  data={savedAnalysis.layer4}
                  word={savedWord}
                  enableAsyncImageWarmup={false}
                  favoriteWords={favoriteWords}
                  onLexicalMapShown={(word) => {
                    wordbook.incrementStageForWord(
                      word,
                      'lexical-map',
                    );
                  }}
                  onImageGenerated={({ baseWord, relatedWord, imageUrl, prompt }) => {
                    if (!normalizedSavedWord) return;
                    wordbook.recordLexicalImage({
                      word: normalizedSavedWord,
                      baseWord,
                      relatedWord,
                      imageUrl,
                      prompt,
                    });
                  }}
                />
              )}

              {savedAnalysis.layer3 && (
                <CommonMistakes mistakes={savedAnalysis.layer3} />
              )}
            </>
          )}
        </div>
      </>
    );
  } else if (!currentWord && !hasAnalysis && !isLoading && !error) {
    mainContent = (
      <div className="flex-1 flex items-center justify-center px-6 pb-6">
        <EmptyState />
      </div>
    );
  } else {
    mainContent = (
      <>
        <Header
          word={activeWord}
          pronunciation={analysisResult?.pronunciation}
          definition={analysisResult?.layer1?.definition}
          isFavorite={isActiveWordFavorite}
          onAddToWordlistClick={
            normalizedActiveWord
              ? () => wordbook.toggleFavoriteByWord(normalizedActiveWord)
              : undefined
          }
        />

        <div className="flex-1 overflow-y-auto space-y-1 pb-4">
          {error ? (
            <ErrorDisplay message={error} onRetry={handleRetry} />
          ) : (
            <>
              <CoachSummary
                word={activeWord}
                personalizedTip={analysisResult?.layer4?.personalizedTip}
                profile={profile}
              />

              {analysisResult?.layer4 && (
                <CognitiveScaffolding
                  data={analysisResult.layer4}
                  word={activeWord}
                  enableAsyncImageWarmup={profile.nickname === 'Lexi Learner'}
                  favoriteWords={favoriteWords}
                  onLexicalMapShown={(word) => {
                    wordbook.incrementStageForWord(
                      word,
                      'lexical-map',
                    );
                  }}
                  onImageGenerated={({ baseWord, relatedWord, imageUrl, prompt }) => {
                    if (!normalizedActiveWord) return;
                    wordbook.recordLexicalImage({
                      word: normalizedActiveWord,
                      baseWord,
                      relatedWord,
                      imageUrl,
                      prompt,
                    });
                  }}
                />
              )}

              {analysisResult?.layer3 && (
                <CommonMistakes mistakes={analysisResult.layer3} />
              )}

              {isLoading && (
                <div className="flex justify-center py-6">
                  <LoadingSpinner
                    text={
                      analysisResult?.layer1
                        ? 'Deepening the pattern, exploring more contexts...'
                        : 'LexiLens is reading the sentence and summoning your coach...'
                    }
                  />
                </div>
              )}
            </>
          )}
        </div>
      </>
    );
  }

  return (
    <div className="h-full w-full bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <motion.div
        initial={{ opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 24 }}
        className="h-full w-full flex flex-col"
      >
        <div className="px-6 pt-4 pb-2">
          <UserProfileCard
            profile={profile}
            theme={theme}
            onToggleTheme={toggleTheme}
            onOpenProfile={() => setView('profile')}
            onLevelClick={() => setIsLevelDialogOpen(true)}
          />
        </div>

        {mainContent}

        <EnglishLevelDialog
          isOpen={isLevelDialogOpen}
          currentLevel={profile.englishLevel}
          onSelect={(level) => {
            updateProfile({ englishLevel: level });
            setIsLevelDialogOpen(false);
          }}
          onClose={() => setIsLevelDialogOpen(false)}
        />
      </motion.div>
    </div>
  );
}

export default App;
