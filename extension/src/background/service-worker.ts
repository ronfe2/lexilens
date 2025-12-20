import type { AnalysisRequest } from '../shared/types';

console.log('LexiLens background service worker loaded');

interface LastSelectionRecord {
  selection: AnalysisRequest;
  tabId?: number;
}

let lastSelection: LastSelectionRecord | null = null;
let isSidepanelOpen = false;
let activeTabId: number | null = null;

// Ensure the side panel is wired to our extension action icon so users
// can always open it manually if automatic opening ever fails.
chrome.runtime.onInstalled.addListener(() => {
  try {
    chrome.sidePanel.setPanelBehavior({
      openPanelOnActionClick: true,
    });
  } catch (err) {
    // Older Chrome builds might not support sidePanel yet – ignore.
    console.warn('Failed to set side panel behavior', err);
  }

  // Create a context menu entry so users can explicitly trigger LexiLens
  // on a selection via right-click.
  try {
    chrome.contextMenus?.create({
      id: 'lexilens_context_menu',
      title: 'LexiLens This',
      contexts: ['selection'],
    });
  } catch (err) {
    console.warn('Failed to create LexiLens context menu', err);
  }
});

// Track the currently active tab so we can associate the side panel context
// with the correct tab even though `sender.tab` is not populated for
// side panel pages.
chrome.tabs.onActivated.addListener(({ tabId }) => {
  activeTabId = tabId;
});

chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) return;

  chrome.tabs.query({ active: true, windowId }, (tabs) => {
    const tab = tabs[0];
    if (tab && tab.id != null) {
      activeTabId = tab.id;
    }
  });
});

function openSidePanelFromTab(tab: chrome.tabs.Tab) {
  const tabId = tab.id;
  const windowId = tab.windowId;

  if (tabId != null && chrome.sidePanel && 'setOptions' in chrome.sidePanel) {
    chrome.sidePanel.setOptions(
      {
        tabId,
        // This path must match the built side panel HTML emitted by Vite/CRX.
        // Vite currently outputs the side panel as `src/sidepanel/index.html`
        // inside the final `dist/` bundle, so we keep that relative path here.
        path: 'src/sidepanel/index.html',
        enabled: true,
      },
      () => {
        if (chrome.runtime.lastError) {
          console.warn('Failed to set side panel options', chrome.runtime.lastError);

          if (windowId != null) {
            chrome.sidePanel.open({ windowId });
          }
          return;
        }

        chrome.sidePanel.open({ tabId });
      },
    );
    return;
  }

  if (windowId != null) {
    try {
      chrome.sidePanel.open({ windowId });
    } catch (err) {
      console.warn('Failed to open side panel by windowId', err);
    }
  }
}

// Track when the side panel UI is actually open or closed by using a
// long-lived port from the side panel React app. We use this to decide
// whether background selection events should influence follow-up behavior.
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'sidepanel') return;

  isSidepanelOpen = true;

  port.onDisconnect.addListener(() => {
    isSidepanelOpen = false;
  });
});

// Best-effort attempt to prepare (and, where allowed, pre-open) the side
// panel when the browser starts so it is readily available. Chrome may
// still enforce a user gesture requirement for actually opening the panel.
chrome.runtime.onStartup.addListener(() => {
  try {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      if (!activeTab || activeTab.id == null) return;

      if (chrome.sidePanel && 'setOptions' in chrome.sidePanel) {
        if (activeTab.windowId == null) return;

        chrome.sidePanel.setOptions(
          {
            tabId: activeTab.id,
            // Use the built asset path as emitted by Vite/CRX.
            path: 'src/sidepanel/index.html',
            enabled: true,
          },
          () => {
            if (chrome.runtime.lastError) {
              console.warn('Failed to set side panel options on startup', chrome.runtime.lastError);
              return;
            }

            try {
              chrome.sidePanel.open({ windowId: activeTab.windowId });
            } catch (err) {
              console.warn('Failed to open side panel on startup', err);
            }
          },
        );
      }
    });
  } catch (err) {
    console.warn('Error during onStartup side panel initialization', err);
  }
});

// Handle context menu clicks for "LexiLens This" – open the side panel
// and ask the content script to process the current selection.
chrome.contextMenus?.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== 'lexilens_context_menu') return;
  if (!tab || tab.id == null) return;

  const selectionText =
    typeof info.selectionText === 'string' ? info.selectionText.trim() : '';

  // Best-effort: seed lastSelection so that even if the content script
  // cannot send a fresh WORD_SELECTED (e.g. extension reloaded and the
  // content script context is invalidated), the side panel can still
  // pick up this selection via SIDE_PANEL_READY and start an analysis.
  if (selectionText) {
    lastSelection = {
      selection: {
        word: selectionText,
        context: selectionText,
        pageType: 'other',
        learningHistory: [],
        url: info.pageUrl,
      },
      tabId: tab.id ?? undefined,
    };
  }

  try {
    openSidePanelFromTab(tab);
  } catch (err) {
    console.warn('Failed to open side panel from context menu', err);
  }

  try {
    chrome.tabs.sendMessage(
      tab.id,
      { type: 'LEXILENS_CONTEXT_MENU' },
      () => {
        if (chrome.runtime.lastError) {
          console.warn(
            'Failed to notify content script from context menu',
            chrome.runtime.lastError,
          );
        }
      },
    );
  } catch (err) {
    console.warn('Error sending context menu trigger to content script', err);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.debug('LexiLens background received message:', message);

  if (message.type === 'LEXILENS_IS_SIDEPANEL_OPEN') {
    sendResponse({ success: true, isOpen: isSidepanelOpen });
    return true;
  }

  if (message.type === 'WORD_SELECTED') {
    const data = message.data || {};
    const tabId = sender.tab?.id;

    // Only treat a selection as the "last" one when the side panel is
    // actually open. This avoids plain text selections made while the
    // panel is closed from implicitly influencing what is queried the
    // next time the panel is opened.
    if (isSidepanelOpen && tabId != null) {
      lastSelection = {
        selection: {
          word: data.word,
          context: data.context,
          pageType: data.pageType,
          learningHistory: data.learningHistory,
          url: data.url,
        },
        tabId,
      };
    }

    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'SIDE_PANEL_READY') {
    // Side panel pages don't populate `sender.tab`, so we fall back to the
    // currently active tab ID tracked via `tabs.onActivated`. This lets us
    // scope the "last selection" to the tab the user is looking at, which
    // avoids replaying explanations when they switch tabs.
    const tabId = sender.tab?.id ?? activeTabId ?? null;

    const selection =
      tabId != null &&
      lastSelection &&
      lastSelection.tabId != null &&
      lastSelection.tabId === tabId
        ? lastSelection.selection
        : null;

    sendResponse({ success: true, selection });
    return true;
  }

  if (message.type === 'LEXILENS_SHOW_LEXICAL_IMAGE') {
    try {
      chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
        const activeTab = tabs[0];
        const targetTabId = activeTab?.id ?? null;

        if (targetTabId == null) {
          sendResponse({ success: false });
          return;
        }

        try {
          chrome.tabs.sendMessage(
            targetTabId,
            {
              type: 'LEXILENS_SHOW_LEXICAL_IMAGE',
              imageUrl: message.imageUrl,
            },
            () => {
              const lastError = chrome.runtime.lastError;
              if (lastError) {
                console.warn(
                  'Failed to forward lexical image overlay message to content script',
                  lastError,
                );
                sendResponse({ success: false });
                return;
              }

              sendResponse({ success: true });
            },
          );
        } catch (err) {
          console.warn('Error sending lexical image overlay message to content script', err);
          sendResponse({ success: false });
        }
      });
    } catch (err) {
      console.warn('Error querying active tab for lexical image overlay', err);
      sendResponse({ success: false });
    }

    // Indicate that we'll respond asynchronously from inside tabs.query / tabs.sendMessage.
    return true;
  }

  sendResponse({ success: false });
  return false;
});

chrome.action.onClicked.addListener((tab) => {
  openSidePanelFromTab(tab);
  // Explicitly opening the side panel via the action icon is a clear
  // signal that the user wants the helper available; no additional
  // background preferences are needed here.
});
