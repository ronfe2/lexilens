import './content-script.css';
import {
  detectPageType,
  extractContext,
  getSentenceContaining,
  debounce,
} from '../shared/utils';

console.log('LexiLens content script loaded');

type SelectionTrigger = 'selection' | 'double-click';

let selectedText = '';
let selectedContext = '';

function buildContextPayload(text: string, trigger: SelectionTrigger) {
  const pageText = document.body.innerText || '';

  // Prefer the full sentence where the selection appears, but extend
  // with surrounding context so the LLM can see the neighborhood.
  const sentence = getSentenceContaining(text, pageText);
  const smartContext = extractContext(sentence, pageText);

  selectedText = text;
  selectedContext = smartContext;

  const pageType = detectPageType(window.location.href);

  return {
    word: selectedText,
    context: selectedContext,
    pageType,
    url: window.location.href,
    trigger,
  };
}

const sendSelection = debounce((payload: ReturnType<typeof buildContextPayload>) => {
  try {
    chrome.runtime.sendMessage(
      {
        type: 'WORD_SELECTED',
        data: payload,
      },
      () => {
        // If the extension context was really invalidated or any other
        // transient error happens, surface it as a warning but don't break
        // the host page.
        if (chrome.runtime.lastError) {
          console.warn('LexiLens: failed to send WORD_SELECTED', chrome.runtime.lastError);
        }
      },
    );
  } catch (err) {
    console.warn('LexiLens: unexpected error sending WORD_SELECTED', err);
  }
}, 150);

document.addEventListener('mouseup', () => {
  const selection = window.getSelection();
  const text = selection?.toString().trim();

  // Short selections (word/phrase) trigger immediate coaching
  if (text && text.length > 0 && text.length < 100) {
    sendSelection(buildContextPayload(text, 'selection'));
  }
});

document.addEventListener('dblclick', () => {
  const selection = window.getSelection();
  const text = selection?.toString().trim();

  // Double-click is treated as strong intent, no length limit
  if (text && text.length > 0) {
    sendSelection(buildContextPayload(text, 'double-click'));
  }
});
