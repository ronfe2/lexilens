import { useCallback, useEffect, useRef } from 'react';
import { API_URL } from '../../shared/constants';
import type {
  AnalysisRequest,
  AnalysisResult,
  LiveContext,
  CognitiveScaffolding,
  InterestTopic,
} from '../../shared/types';
import { useAppStore } from '../../store/appStore';

interface SSEEvent<T = unknown> {
  event: string;
  data?: T;
}

interface UseStreamingAnalysisOptions {
  onAnalysisComplete?: (request: AnalysisRequest) => void;
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
    } catch (err) {
      // Log parse failures in the sidepanel console so malformed payloads
      // are visible during development, but don't break the UI.
      // eslint-disable-next-line no-console
      console.warn('[LexiLens] Failed to parse SSE data as JSON', err, dataStr);
      data = undefined;
    }
  }

  const parsed: SSEEvent = { event: eventName || 'message', data };

  // Lightweight debug hook to help diagnose streaming issues in the sidepanel.
  // This only logs in the extension devtools console, not on host pages.
  // eslint-disable-next-line no-console
  console.debug('[LexiLens] Parsed SSE event', parsed);

  return parsed;
}

export function useStreamingAnalysis(options?: UseStreamingAnalysisOptions) {
  const {
    setCurrentWord,
    setCurrentContext,
    setAnalysisResult,
    updateAnalysisLayer,
    setLoading,
    setError,
  } = useAppStore();

  const onAnalysisComplete = options?.onAnalysisComplete;
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
      // Store the full context for UI preview under the headword
      setCurrentContext(request.context);
      setError(null);
      setLoading(true);

      // Seed base analysis result so streamed layers can attach progressively
      setAnalysisResult({ word: request.word } as AnalysisResult);

      let accumulatedLayer1 = '';
       let accumulatedLayer4Personalized = '';

      const handleEvent = (evt: SSEEvent) => {
        const { event, data } = evt;

        if (!event) return;

        // eslint-disable-next-line no-console
        console.debug('[LexiLens] Handling SSE event', event, data);

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
          case 'layer4_personalized_chunk': {
            if (!data || typeof data !== 'object') return;
            const content = (data as any).content ?? '';
            if (typeof content !== 'string' || !content) return;

            accumulatedLayer4Personalized += content;

            // Merge streamed 解读内容 with any relatedWords that may have
            // already arrived (or not) so the CoachSummary can start
            // rendering personalized text as early as possible.
            const { analysisResult } = useAppStore.getState();
            const existingLayer4 = analysisResult?.layer4;
            const relatedWords = existingLayer4?.relatedWords ?? [];

            const cognitive: CognitiveScaffolding = {
              relatedWords,
              personalizedTip: accumulatedLayer4Personalized,
            };

            updateAnalysisLayer('layer4', cognitive);
            break;
          }
          case 'layer4': {
            if (!data || typeof data !== 'object') return;
            const relatedWordsRaw = (data as any).related_words ?? [];
            const personalized = (data as any).personalized ?? undefined;

            const { analysisResult } = useAppStore.getState();
            const existingLayer4 = analysisResult?.layer4;
            const existingPersonalized =
              (existingLayer4?.personalizedTip ?? '').toString().trim() || '';

            const cognitive: CognitiveScaffolding = {
              relatedWords: Array.isArray(relatedWordsRaw)
                ? relatedWordsRaw.map((rw: any) => ({
                    word: rw.word,
                    relationship: rw.relationship,
                    keyDifference: rw.difference,
                    whenToUse: rw.when_to_use,
                  }))
                : [],
              // Prefer the streamed 解读内容 when available so the user sees
              // a continuous streaming experience. Fall back to the JSON
              // field for non-streaming clients or error cases.
              personalizedTip:
                (accumulatedLayer4Personalized || existingPersonalized || personalized) ??
                undefined,
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
            // eslint-disable-next-line no-console
            console.debug('[LexiLens] Ignoring unknown SSE event', event, data);
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
        const payload: {
          word: string;
          context: string;
          page_type?: AnalysisRequest['pageType'];
          learning_history?: string[];
          english_level?: string;
          url?: string;
          interests?: {
            id: string;
            title: string;
            summary: string;
            urls: string[];
          }[];
          blocked_titles?: string[];
          favorite_words?: string[];
          layers?: number[];
        } = {
          word: request.word,
          context: request.context,
          page_type: request.pageType,
          learning_history: request.learningHistory,
          english_level: request.englishLevel,
          url: request.url,
        };

        // By default, request only Lexical Map (Layer 4) and Live Contexts (Layer 2).
        // Common Mistakes (Layer 3) is now generated lazily when the user clicks
        // the "生成常见错误" button.
        const requestedLayers =
          Array.isArray(request.layers) && request.layers.length > 0
            ? request.layers
            : [2, 4];
        payload.layers = requestedLayers;

        if (request.interests && request.interests.length > 0) {
          payload.interests = (request.interests as InterestTopic[]).map(
            (topic) => ({
              id: topic.id,
              title: topic.title,
              summary: topic.summary,
              urls: topic.links.map((link) => link.url),
            }),
          );
        }

        if (request.blockedTitles && request.blockedTitles.length > 0) {
          payload.blocked_titles = request.blockedTitles;
        }

        if (request.favoriteWords && request.favoriteWords.length > 0) {
          payload.favorite_words = request.favoriteWords;
        }

        const response = await fetch(`${API_URL}/api/analyze`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error(`API error: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        let doneReading = false;

        while (!doneReading) {
          const { done, value } = await reader.read();
          if (done) {
            doneReading = true;
            break;
          }

          buffer += decoder.decode(value, { stream: true });

          // SSE events are separated by a blank line. Depending on the server,
          // lines may be terminated with '\n' or '\r\n', so we normalize by
          // looking for the generic pattern "\r?\n\r?\n".
          // This ensures compatibility with sse-starlette's default "\r\n".
          // eslint-disable-next-line no-constant-condition
          while (true) {
            const match = buffer.match(/\r?\n\r?\n/);
            if (!match || match.index === undefined) break;

            const boundary = match.index;
            const rawEvent = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + match[0].length);

            const parsed = parseSSEEvent(rawEvent);
            if (parsed) {
              handleEvent(parsed);
            }
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

        if (typeof onAnalysisComplete === 'function') {
          onAnalysisComplete(request);
        }
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
      setCurrentContext,
      setAnalysisResult,
      updateAnalysisLayer,
      setLoading,
      setError,
      stop,
      onAnalysisComplete,
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
