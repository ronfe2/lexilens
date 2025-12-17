import { create } from 'zustand';
import type { AnalysisResult } from '../shared/types';

interface AppState {
  currentWord: string | null;
  analysisResult: AnalysisResult | null;
  isLoading: boolean;
  error: string | null;

  setCurrentWord: (word: string) => void;
  setAnalysisResult: (result: AnalysisResult | null) => void;
  updateAnalysisLayer: (layerKey: keyof AnalysisResult, data: any) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentWord: null,
  analysisResult: null,
  isLoading: false,
  error: null,

  setCurrentWord: (word) => set({ currentWord: word }),

  setAnalysisResult: (result) => set({ analysisResult: result }),

  updateAnalysisLayer: (layerKey, data) =>
    set((state) => {
      // Ensure we always have a base AnalysisResult object so layers can
      // progressively stream in without being dropped when null.
      const base: AnalysisResult =
        state.analysisResult ??
        ({
          word: state.currentWord ?? '',
        } as AnalysisResult);

      return {
        analysisResult: {
          ...base,
          [layerKey]: data,
        },
      };
    }),

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),

  reset: () =>
    set({
      currentWord: null,
      analysisResult: null,
      isLoading: false,
      error: null,
    }),
}));
