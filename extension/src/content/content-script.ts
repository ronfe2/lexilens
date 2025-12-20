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
let sidepanelOpen = false;

let floatingButton: HTMLButtonElement | null = null;
let floatingButtonPayload: ReturnType<typeof buildContextPayload> | null = null;

function hideFloatingButton() {
  if (floatingButton && floatingButton.parentNode) {
    floatingButton.parentNode.removeChild(floatingButton);
  }
  floatingButtonPayload = null;
}

function ensureFloatingButton(): HTMLButtonElement {
  if (floatingButton) {
    if (!document.body.contains(floatingButton)) {
      document.body.appendChild(floatingButton);
    }
    return floatingButton;
  }

  const button = document.createElement('button');
  button.id = 'lexilens-floating-button';
  button.className = 'lexilens-floating-button';
  button.type = 'button';
  button.textContent = 'LexiLens It';

  button.addEventListener('click', (event) => {
    event.stopPropagation();
    if (!floatingButtonPayload) return;
    sendSelection(floatingButtonPayload);
    hideFloatingButton();
  });

  document.body.appendChild(button);
  floatingButton = button;
  return button;
}

function positionFloatingButton(rect: DOMRect) {
  const button = ensureFloatingButton();

  const scrollX = window.scrollX || document.documentElement.scrollLeft || 0;
  const scrollY = window.scrollY || document.documentElement.scrollTop || 0;

  const buttonWidth = 120;
  const horizontalPadding = 8;

  let left = rect.left + scrollX;
  const top = rect.bottom + scrollY + 8;

  const viewportRight = scrollX + window.innerWidth - horizontalPadding;
  if (left + buttonWidth > viewportRight) {
    left = Math.max(horizontalPadding, viewportRight - buttonWidth);
  }

  button.style.left = `${left}px`;
  button.style.top = `${top}px`;
}

function getSelectionRect(): DOMRect | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;

  try {
    const range = selection.getRangeAt(0).cloneRange();
    const rects = range.getClientRects();
    if (!rects || rects.length === 0) {
      const rect = range.getBoundingClientRect();
      return rect && rect.width && rect.height ? rect : null;
    }
    return rects[rects.length - 1];
  } catch {
    return null;
  }
}

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

function handleUserSelection(trigger: SelectionTrigger) {
  const selection = window.getSelection();
  const text = selection?.toString().trim();

  if (!text || text.length === 0) {
    hideFloatingButton();
    return;
  }

  // Only react to selections when the side panel is open. When the panel
  // is closed, selection is just part of normal reading and should not
  // trigger LexiLens; users explicitly use the context menu instead.
  if (!sidepanelOpen) {
    hideFloatingButton();
    return;
  }

  const rect = getSelectionRect();
  if (!rect) {
    hideFloatingButton();
    return;
  }

  const payload = buildContextPayload(text, trigger);
  floatingButtonPayload = payload;
  positionFloatingButton(rect);
}

document.addEventListener('mouseup', () => {
  handleUserSelection('selection');
});

document.addEventListener('dblclick', () => {
  handleUserSelection('double-click');
});

chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
  if (message?.type === 'LEXILENS_SIDEPANEL_STATE') {
    sidepanelOpen = Boolean(message.open);
    if (!sidepanelOpen) {
      hideFloatingButton();
    }
  }

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

// Hide the LexiLens floating button on scroll, resize, or when the user
// presses Escape so it never lingers in an awkward position.
window.addEventListener(
  'scroll',
  () => {
    hideFloatingButton();
  },
  { passive: true, capture: true },
);

window.addEventListener(
  'resize',
  () => {
    hideFloatingButton();
  },
  { passive: true },
);

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    hideFloatingButton();
  }
});
