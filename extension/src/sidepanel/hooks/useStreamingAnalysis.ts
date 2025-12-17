import { useCallback, useEffect, useRef } from 'react';
import { API_URL } from '../../shared/constants';
import type {
  AnalysisRequest,
  AnalysisResult,
  LiveContext,
  CognitiveScaffolding,
} from '../../shared/types';
import { useAppStore } from '../../store/appStore';

interface SSEEvent<T = unknown> {
  event: string;
  data?: T;
}

function parseSSEEvent(rawEvent: string): SSEEvent | null {
  const lines = rawEvent.split('\n');
  let eventName = 'message';
  let dataStr = '';

  for (const line of lines) {
    if (line.startsWith('event:')) {
      eventName = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      // Multiple data lines should be concatenated with newlines
      if (dataStr) dataStr += '\n';
      dataStr += line.slice(5).trim();
    }
  }

  if (!eventName && !dataStr) return null;

  let data: unknown;
  if (dataStr) {
    try {
      data = JSON.parse(dataStr);
    } catch {
      // Swallow JSON parse errors – invalid payloads are ignored
      data = undefined;
    }
  }

  return { event: eventName || 'message', data };
}

export function useStreamingAnalysis() {
  const {
    setCurrentWord,
    setAnalysisResult,
    updateAnalysisLayer,
    setLoading,
    setError,
  } = useAppStore();

  const controllerRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    if (controllerRef.current) {
      controllerRef.current.abort();
      controllerRef.current = null;
    }
  }, []);

  const startAnalysis = useCallback(
    async (request: AnalysisRequest) => {
      if (!request.word || !request.context) return;

      // Cancel any in-flight streams
      stop();

      const controller = new AbortController();
      controllerRef.current = controller;

      setCurrentWord(request.word);
      setError(null);
      setLoading(true);

      // Seed base analysis result so streamed layers can attach progressively
      setAnalysisResult({ word: request.word } as AnalysisResult);

      let accumulatedLayer1 = '';

      const handleEvent = (evt: SSEEvent) => {
        const { event, data } = evt;

        if (!event) return;

        switch (event) {
          case 'layer1_chunk': {
            if (!data || typeof data !== 'object') return;
            const content = (data as any).content ?? '';
            accumulatedLayer1 += content;
            updateAnalysisLayer('layer1', {
              definition: accumulatedLayer1,
              generatedAt: Date.now(),
            });
            break;
          }
          case 'layer1_complete': {
            if (!accumulatedLayer1 && data && typeof data === 'object') {
              accumulatedLayer1 = (data as any).content ?? '';
            }
            if (accumulatedLayer1) {
              updateAnalysisLayer('layer1', {
                definition: accumulatedLayer1,
                generatedAt: Date.now(),
              });
            }
            break;
          }
          case 'layer2': {
            if (!data || typeof data !== 'object') return;
            const rawContexts = (data as any).contexts ?? [];
            const contexts: LiveContext[] = Array.isArray(rawContexts)
              ? rawContexts.map((ctx: any) => ({
                  source: ctx.source,
                  text: ctx.text,
                  highlightedWord: request.word,
                }))
              : [];
            updateAnalysisLayer('layer2', contexts);
            break;
          }
          case 'layer3': {
            if (!data || typeof data !== 'object') return;
            const rawMistakes = (data as any).mistakes ?? [];
            updateAnalysisLayer('layer3', Array.isArray(rawMistakes) ? rawMistakes : []);
            break;
          }
          case 'layer4': {
            if (!data || typeof data !== 'object') return;
            const relatedWordsRaw = (data as any).related_words ?? [];
            const personalized = (data as any).personalized ?? undefined;

            const cognitive: CognitiveScaffolding = {
              relatedWords: Array.isArray(relatedWordsRaw)
                ? relatedWordsRaw.map((rw: any) => ({
                    word: rw.word,
                    relationship: rw.relationship,
                    keyDifference: rw.difference,
                    whenToUse: rw.when_to_use,
                  }))
                : [],
              personalizedTip: personalized,
            };

            updateAnalysisLayer('layer4', cognitive);
            break;
          }
          case 'layer2_error':
          case 'layer3_error':
          case 'layer4_error':
          case 'error': {
            const message =
              data && typeof data === 'object' && (data as any).error
                ? (data as any).error
                : 'Something went wrong while analyzing this word.';
            setError(message);
            break;
          }
          case 'done': {
            setLoading(false);
            break;
          }
          default:
            break;
        }
      };

      // Kick off pronunciation lookup in parallel (non-blocking)
      (async () => {
        try {
          const resp = await fetch(
            `${API_URL}/api/pronunciation/${encodeURIComponent(request.word)}`,
          );
          if (!resp.ok) return;
          const data = await resp.json();
          const pronunciation = {
            ipa: data.ipa ?? '',
            audioUrl: data.audio_url ?? undefined,
          };
          updateAnalysisLayer('pronunciation', pronunciation);
        } catch {
          // Pronunciation is best-effort only; ignore failures
        }
      })();

      try {
        const response = await fetch(`${API_URL}/api/analyze`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            word: request.word,
            context: request.context,
            page_type: request.pageType,
            learning_history: request.learningHistory,
            url: request.url,
          }),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error(`API error: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          let boundary = buffer.indexOf('\n\n');
          while (boundary !== -1) {
            const rawEvent = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 2);
            const parsed = parseSSEEvent(rawEvent);
            if (parsed) {
              handleEvent(parsed);
            }
            boundary = buffer.indexOf('\n\n');
          }
        }

        // Flush any remaining buffered data
        if (buffer.trim().length > 0) {
          const parsed = parseSSEEvent(buffer);
          if (parsed) {
            handleEvent(parsed);
          }
        }

        // Ensure loading flag is cleared if "done" was never reached
        setLoading(false);
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          // Stream cancelled intentionally
          return;
        }

        console.error('Streaming analysis failed', err);
        setError('Unable to contact LexiLens coach. Please try again.');
        setLoading(false);
      }
    },
    [
      setCurrentWord,
      setAnalysisResult,
      updateAnalysisLayer,
      setLoading,
      setError,
      stop,
    ],
  );

  useEffect(
    () => () => {
      // Cleanup on unmount
      stop();
    },
    [stop],
  );

  return { startAnalysis, stop };
}

