import type { AnalysisRequest } from '../shared/types';

console.log('LexiLens background service worker loaded');

let lastSelection: AnalysisRequest | null = null;

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
});

function openSidePanelFromMessageSender(sender: chrome.runtime.MessageSender) {
  const tabId = sender.tab?.id;
  const windowId = sender.tab?.windowId;

  // Prefer the newer tabId-based API when available; fall back to windowId
  // so we still work on older Chrome versions / platforms.
  if (tabId != null && chrome.sidePanel && 'setOptions' in chrome.sidePanel) {
    chrome.sidePanel.setOptions(
      {
        tabId,
        path: 'src/sidepanel/index.html',
        enabled: true,
      },
      () => {
        if (chrome.runtime.lastError) {
          console.warn('Failed to set side panel options', chrome.runtime.lastError);

          // Fallback: try the simpler window-based open if possible
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

function openSidePanelFromTab(tab: chrome.tabs.Tab) {
  const tabId = tab.id;
  const windowId = tab.windowId;

  if (tabId != null && chrome.sidePanel && 'setOptions' in chrome.sidePanel) {
    chrome.sidePanel.setOptions(
      {
        tabId,
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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message);

  if (message.type === 'WORD_SELECTED') {
    const data = message.data || {};

    lastSelection = {
      word: data.word,
      context: data.context,
      pageType: data.pageType,
      learningHistory: data.learningHistory,
      url: data.url,
    };

    if (sender.tab) {
      openSidePanelFromMessageSender(sender);
    }

    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'SIDE_PANEL_READY') {
    sendResponse({ success: true, selection: lastSelection });
    return true;
  }

  sendResponse({ success: false });
  return false;
});

chrome.action.onClicked.addListener((tab) => {
  openSidePanelFromTab(tab);
});
