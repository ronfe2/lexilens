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
  
  updateAnalysisLayer: (layerKey, data) => set((state) => ({
    analysisResult: state.analysisResult 
      ? { ...state.analysisResult, [layerKey]: data }
      : null,
  })),
  
  setLoading: (loading) => set({ isLoading: loading }),
  
  setError: (error) => set({ error }),
  
  reset: () => set({
    currentWord: null,
    analysisResult: null,
    isLoading: false,
    error: null,
  }),
}));
