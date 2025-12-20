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
let imageOverlayElement: HTMLDivElement | null = null;

function showImageOverlay(imageUrl: string) {
  if (!imageUrl) return;

  if (imageOverlayElement) {
    const img = imageOverlayElement.querySelector('img');
    if (img) {
      img.src = imageUrl;
    }
    if (!document.body.contains(imageOverlayElement)) {
      document.body.appendChild(imageOverlayElement);
    }
    return;
  }

  const overlay = document.createElement('div');
  overlay.id = 'lexilens-image-overlay';
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.zIndex = '2147483647';
  overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.cursor = 'zoom-out';

  const img = document.createElement('img');
  img.src = imageUrl;
  img.alt = '';
  img.style.maxWidth = '90vw';
  img.style.maxHeight = '90vh';
  img.style.boxShadow = '0 10px 40px rgba(0,0,0,0.5)';
  img.style.borderRadius = '12px';
  img.style.backgroundColor = '#ffffff';

  overlay.appendChild(img);

  overlay.addEventListener('click', () => {
    if (overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
  });

  imageOverlayElement = overlay;
  document.body.appendChild(overlay);
}

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
        // Extension context might be invalidated if the extension was
        // reloaded while this tab is still open. In that case we silently
        // ignore the error so we don't spam the page console.
        const lastError = chrome.runtime.lastError;
        if (!lastError) return;

        const message = String(lastError.message || '');
        if (message.includes('Extension context invalidated')) {
          return;
        }

        console.warn('LexiLens: failed to send WORD_SELECTED', lastError);
      },
    );
  } catch (err: any) {
    const message = String((err && err.message) || '');
    if (message.includes('Extension context invalidated')) {
      return;
    }

    console.warn('LexiLens: unexpected error sending WORD_SELECTED', err);
  }
}, 150);

document.addEventListener('mouseup', () => {
  const selection = window.getSelection();
  const text = selection?.toString().trim();

  // When the side panel is open, any non-empty selection should trigger
  // an explanation. The side panel itself decides whether to act on it.
  if (text && text.length > 0) {
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

chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
  // Allow the background script (e.g. from a context menu click) to ask the
  // content script to send the current selection through the normal pipeline.
  if (message?.type === 'LEXILENS_CONTEXT_MENU') {
    const selection = window.getSelection();
    const text = selection?.toString().trim();

    if (text && text.length > 0) {
      sendSelection(buildContextPayload(text, 'double-click'));
    }
  }

  if (message?.type === 'LEXILENS_SHOW_LEXICAL_IMAGE' && typeof message.imageUrl === 'string') {
    showImageOverlay(message.imageUrl);
  }
});
