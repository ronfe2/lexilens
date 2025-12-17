import { useCallback, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import Header from '../components/Header';
import BehaviorPattern from '../components/BehaviorPattern';
import LiveContexts from '../components/LiveContexts';
import CommonMistakes from '../components/CommonMistakes';
import CognitiveScaffolding from '../components/CognitiveScaffolding';
import EmptyState from '../components/EmptyState';
import ErrorDisplay from '../components/ErrorDisplay';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAppStore } from '../store/appStore';
import { useStreamingAnalysis } from './hooks/useStreamingAnalysis';
import { useLearningHistory } from './hooks/useLearningHistory';
import { useTheme } from './hooks/useTheme';
import type { AnalysisRequest } from '../shared/types';

function App() {
  const { currentWord, analysisResult, isLoading, error, reset } = useAppStore();
  const { words: learningWords, addEntry } = useLearningHistory();
  const { startAnalysis } = useStreamingAnalysis();
  const { theme, toggleTheme } = useTheme();

  const lastSelectionRef = useRef<AnalysisRequest | null>(null);

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
        url: data.url,
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
    },
    [learningWords, addEntry, startAnalysis],
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

  const hasAnalysis =
    !!analysisResult?.layer1 ||
    !!analysisResult?.layer2 ||
    !!analysisResult?.layer3 ||
    !!analysisResult?.layer4;

  if (!currentWord && !hasAnalysis && !isLoading && !error) {
    return (
      <div className="h-full w-full bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <EmptyState />
      </div>
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
        <Header
          word={analysisResult?.word || currentWord || ''}
          pronunciation={analysisResult?.pronunciation}
          theme={theme}
          onToggleTheme={toggleTheme}
        />

        <div className="flex-1 overflow-y-auto space-y-1 pb-4">
          {error ? (
            <ErrorDisplay message={error} onRetry={handleRetry} />
          ) : (
            <>
              {analysisResult?.layer1 && (
                <BehaviorPattern data={analysisResult.layer1} />
              )}

              {analysisResult?.layer2 && (
                <LiveContexts contexts={analysisResult.layer2} />
              )}

              {analysisResult?.layer3 && (
                <CommonMistakes mistakes={analysisResult.layer3} />
              )}

              {analysisResult?.layer4 && (
                <CognitiveScaffolding
                  data={analysisResult.layer4}
                  word={analysisResult.word || currentWord || ''}
                />
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
      </motion.div>
    </div>
  );
}

export default App;
