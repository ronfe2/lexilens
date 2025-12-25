import { useCallback } from 'react';
import type { AnalysisRequest, AnalysisResult } from '../../shared/types';
import { useAppStore } from '../../store/appStore';

type ExposureReason = 'analysis' | 'lexical-map';

interface WordbookPersistenceActions {
  upsertEntryFromAnalysis: (params: {
    request: AnalysisRequest;
    analysis: AnalysisResult;
  }) => void;
  incrementStageForWord: (word: string, reason: ExposureReason) => void;
}

interface UseAnalysisPersistenceResult {
  /**
   * Callback invoked when a streaming analysis run has completed
   * successfully. Responsible for persisting the latest analysis into
   * the wordbook and incrementing mastery for the headword.
   */
  onAnalysisComplete: (request: AnalysisRequest) => void;
}

export function useAnalysisPersistence(
  actions: WordbookPersistenceActions,
): UseAnalysisPersistenceResult {
  const { upsertEntryFromAnalysis, incrementStageForWord } = actions;

  const onAnalysisComplete = useCallback(
    (request: AnalysisRequest) => {
      // Read the freshest analysis result from the central store rather
      // than capturing it in a closure, because streaming updates come
      // in asynchronously.
      const { analysisResult } = useAppStore.getState();

      if (!analysisResult) {
        // Nothing to persist; this can happen if the stream failed very
        // early or the state was reset mid-run.
        return;
      }

      try {
        upsertEntryFromAnalysis({
          request,
          analysis: analysisResult,
        });

        // Each completed explanation counts as one successful exposure
        // for the headword.
        incrementStageForWord(request.word, 'analysis');
      } catch (err) {
        // Persistence issues should never surface as hard errors in the
        // coaching UI; log for debugging only.
        // eslint-disable-next-line no-console
        console.warn(
          '[LexiLens] Failed to persist analysis into wordbook',
          err,
        );
      }
    },
    [upsertEntryFromAnalysis, incrementStageForWord],
  );

  return { onAnalysisComplete };
}

