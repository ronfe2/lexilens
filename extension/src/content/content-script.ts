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
let selectionButton: HTMLButtonElement | null = null;

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

function removeSelectionButton() {
  if (selectionButton && selectionButton.parentNode) {
    selectionButton.parentNode.removeChild(selectionButton);
  }
  selectionButton = null;
}

function createOrUpdateSelectionButton(range: Range, text: string) {
  if (!selectionButton) {
    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'lexilens-selection-button';
    button.textContent = 'LexiLens This';

    // Keep the inline styles minimal but visually distinct so the button
    // is clearly associated with LexiLens without overwhelming the host page.
    button.style.position = 'absolute';
    button.style.zIndex = '2147483647';
    button.style.padding = '4px 10px';
    button.style.fontSize = '12px';
    button.style.fontFamily =
      'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    button.style.backgroundColor = '#2563eb';
    button.style.color = '#ffffff';
    button.style.border = 'none';
    button.style.borderRadius = '999px';
    button.style.boxShadow = '0 4px 12px rgba(15, 23, 42, 0.25)';
    button.style.cursor = 'pointer';
    button.style.whiteSpace = 'nowrap';

    // Prevent the button from interfering with text selection.
    button.addEventListener('mousedown', (event) => {
      event.preventDefault();
      event.stopPropagation();
    });

    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();

      const selection = window.getSelection();
      const currentText = selection?.toString().trim() || text.trim();
      if (!currentText) {
        removeSelectionButton();
        return;
      }

      sendSelection(buildContextPayload(currentText, 'selection'));
      removeSelectionButton();
    });

    selectionButton = button;
    document.body.appendChild(selectionButton);
  }

  const rect = range.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) {
    removeSelectionButton();
    return;
  }

  const verticalOffset = 8;
  const top = window.scrollY + rect.bottom + verticalOffset;
  let left = window.scrollX + rect.left;

  // Avoid overflowing off the right edge of the viewport.
  const maxLeft =
    window.scrollX + document.documentElement.clientWidth - 140;
  if (left > maxLeft) {
    left = maxLeft;
  }

  selectionButton.style.top = `${top}px`;
  selectionButton.style.left = `${left}px`;
}

function showSelectionButtonForCurrentSelection() {
  const selection = window.getSelection();
  const text = selection?.toString().trim();

  if (!selection || !text) {
    removeSelectionButton();
    return;
  }

  if (selection.rangeCount === 0) {
    removeSelectionButton();
    return;
  }

  const range = selection.getRangeAt(0);

  // Only show the floating button when the side panel is open so the
  // user has an obvious place for the explanation to appear. We query
  // the background script, but fall back to showing the button if the
  // message channel is unavailable so the UX does not silently break.
  try {
    chrome.runtime.sendMessage(
      { type: 'LEXILENS_IS_SIDEPANEL_OPEN' },
      (response?: { isOpen?: boolean }) => {
        const lastError = chrome.runtime.lastError;
        if (lastError) {
          const message = String(lastError.message || '');
          if (message.includes('Extension context invalidated')) {
            // Extension was reloaded; do not show stale controls.
            return;
          }

          // If we cannot reliably query the side panel state, still
          // show the button so selection → explanation remains usable.
          createOrUpdateSelectionButton(range, text);
          return;
        }

        if (!response || response.isOpen !== true) {
          removeSelectionButton();
          return;
        }

        createOrUpdateSelectionButton(range, text);
      },
    );
  } catch (err: any) {
    const message = String((err && err.message) || '');
    if (message.includes('Extension context invalidated')) {
      return;
    }

    // If messaging fails for any other reason, fall back to showing
    // the button so the feature still works in degraded mode.
    createOrUpdateSelectionButton(range, text);
  }
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
  showSelectionButtonForCurrentSelection();
});

document.addEventListener('dblclick', () => {
  // For consistency with the floating button UX, a double-click now
  // only updates the selection + button position. The user explicitly
  // chooses whether to start analysis by clicking "LexiLens This".
  showSelectionButtonForCurrentSelection();
});

// Hide the floating button when the user starts a new interaction that
// likely invalidates the previous selection.
document.addEventListener(
  'mousedown',
  (event) => {
    if (selectionButton && event.target instanceof Node) {
      if (!selectionButton.contains(event.target)) {
        removeSelectionButton();
      }
    }
  },
  true,
);

document.addEventListener(
  'scroll',
  () => {
    // Scrolling usually means the user moved away from the current
    // selection; hiding avoids leaving the button floating mid-page.
    removeSelectionButton();
  },
  true,
);

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
