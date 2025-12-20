import { useCallback, useEffect, useRef, useState } from 'react';
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
  const { startAnalysis } = useStreamingAnalysis();
  const { theme, toggleTheme } = useTheme();
  const { profile, updateProfile } = useUserProfile();
  const interests = useInterests();
  const { topics, blockedTitles, addOrUpdateFromServer } = interests;

  const [view, setView] = useState<'coach' | 'profile'>('coach');
  const [isLevelDialogOpen, setIsLevelDialogOpen] = useState(false);

  const lastSelectionRef = useRef<AnalysisRequest | null>(null);
  const handleSelectionRef = useRef<(data: any) => void>();

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
      };

      lastSelectionRef.current = request;

      // Record into learning history for personalization
      addEntry({
        word: data.word,
        context: data.context,
        timestamp: Date.now(),
      });

      // Fire-and-forget streaming analysis
      void startAnalysis(request);
      // In parallel, ask the backend to summarize/update interest topics
      updateInterestsFromUsage(request);
    },
    [
      learningWords,
      addEntry,
      startAnalysis,
      profile.englishLevel,
      topics,
      blockedTitles,
      updateInterestsFromUsage,
    ],
  );

  // Always keep a ref to the latest handleSelection so our message
  // listener can call it without forcing the effect to re-run and
  // re-send SIDE_PANEL_READY (which would cause duplicate analyses).
  useEffect(() => {
    handleSelectionRef.current = handleSelection;
  }, [handleSelection]);

  useEffect(() => {
    console.log('LexiLens sidepanel loaded');

    // Ask background for the last selected word when side panel opens
    chrome.runtime.sendMessage({ type: 'SIDE_PANEL_READY' }, (response) => {
      if (chrome.runtime.lastError) {
        // Side panel might open without background ready; fail silently
        return;
      }

      if (response?.selection) {
        handleSelectionRef.current?.(response.selection);
      }
    });

    // Listen for live selection events while side panel stays open
    const listener = (message: any) => {
      if (message?.type === 'WORD_SELECTED') {
        handleSelectionRef.current?.(message.data);
      }
    };

    chrome.runtime.onMessage.addListener(listener);

    return () => {
      chrome.runtime.onMessage.removeListener(listener);
    };
  }, []);

  const handleRetry = () => {
    reset();
    if (lastSelectionRef.current) {
      void startAnalysis(lastSelectionRef.current);
    }
  };

  const hasAnalysis =
    !!analysisResult?.layer1 ||
    !!analysisResult?.layer3 ||
    !!analysisResult?.layer4;

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

        {view === 'profile' ? (
          <div className="flex-1 overflow-y-auto">
            <ProfilePage
              profile={profile}
              onUpdateProfile={updateProfile}
              onBack={() => setView('coach')}
              onLevelClick={() => setIsLevelDialogOpen(true)}
              interests={interests}
            />
          </div>
        ) : (!currentWord && !hasAnalysis && !isLoading && !error) ? (
          <div className="flex-1 flex items-center justify-center px-6 pb-6">
            <EmptyState />
          </div>
        ) : (
          <>
            <Header
              word={analysisResult?.word || currentWord || ''}
              pronunciation={analysisResult?.pronunciation}
              definition={analysisResult?.layer1?.definition}
              onAddToWordlistClick={() => {
                // eslint-disable-next-line no-console
                console.log('[LexiLens] Add to wordlist clicked (coming soon)');
              }}
            />

            <div className="flex-1 overflow-y-auto space-y-1 pb-4">
              {error ? (
                <ErrorDisplay message={error} onRetry={handleRetry} />
              ) : (
                <>
                  <CoachSummary
                    word={analysisResult?.word || currentWord || ''}
                    personalizedTip={analysisResult?.layer4?.personalizedTip}
                    profile={profile}
                  />

                  {analysisResult?.layer4 && (
                    <CognitiveScaffolding
                      data={analysisResult.layer4}
                      word={analysisResult.word || currentWord || ''}
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
        )}

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
