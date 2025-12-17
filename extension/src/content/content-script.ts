import './content-script.css';
import {
  detectPageType,
  extractContext,
  getSentenceContaining,
  debounce,
} from '../shared/utils';

console.log('LexiLens content script loaded');

let selectedText = '';
let selectedContext = '';

function buildContextPayload(text: string) {
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
  };
}

const sendSelection = debounce((payload: ReturnType<typeof buildContextPayload>) => {
  chrome.runtime.sendMessage({
    type: 'WORD_SELECTED',
    data: payload,
  });
}, 150);

document.addEventListener('mouseup', () => {
  const selection = window.getSelection();
  const text = selection?.toString().trim();

  // Short selections (word/phrase) trigger immediate coaching
  if (text && text.length > 0 && text.length < 100) {
    sendSelection(buildContextPayload(text));
  }
});

document.addEventListener('dblclick', () => {
  const selection = window.getSelection();
  const text = selection?.toString().trim();

  // Double-click is treated as strong intent, no length limit
  if (text && text.length > 0) {
    sendSelection(buildContextPayload(text));
  }
});
