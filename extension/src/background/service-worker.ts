import type { AnalysisRequest } from '../shared/types';
import { STORAGE_KEYS } from '../shared/constants';

console.log('LexiLens background service worker loaded');

let lastSelection: AnalysisRequest | null = null;

interface SidepanelPrefs {
  autoOpenOnSelection: boolean;
}
let autoOpenOnSelection = true;

function loadSidepanelPrefs() {
  try {
    chrome.storage?.local.get(STORAGE_KEYS.SIDEPANEL_PREFS, (result) => {
      const stored = result?.[STORAGE_KEYS.SIDEPANEL_PREFS] as SidepanelPrefs | undefined;
      if (stored && typeof stored.autoOpenOnSelection === 'boolean') {
        autoOpenOnSelection = stored.autoOpenOnSelection;
      }
    });
  } catch {
    // If storage is not available, fall back to in-memory defaults.
  }
}

function persistSidepanelPrefs() {
  const prefs: SidepanelPrefs = {
    autoOpenOnSelection,
  };

  try {
    chrome.storage?.local.set({
      [STORAGE_KEYS.SIDEPANEL_PREFS]: prefs,
    });
  } catch {
    // Ignore persistence failures – preferences will reset next session.
  }
}

function setAutoOpenOnSelection(value: boolean) {
  autoOpenOnSelection = value;
  persistSidepanelPrefs();
}

loadSidepanelPrefs();

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

// Track when the side panel UI is actually open or closed by using a
// long-lived port from the side panel React app.
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'sidepanel') return;

  setAutoOpenOnSelection(true);

  port.onDisconnect.addListener(() => {
    // Treat an explicit side panel close as a signal to stop auto-opening
    // on plain text selection until the user re-opens it.
    setAutoOpenOnSelection(false);
  });
});

// Best-effort attempt to prepare the side panel when the browser starts.
// Chrome may still enforce a user gesture requirement for actually opening
// the panel; in that case we at least ensure the first text selection can
// open it quickly according to user preferences.
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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message);

  if (message.type === 'WORD_SELECTED') {
    const data = message.data || {};

    const trigger: 'selection' | 'double-click' =
      data.trigger === 'double-click' ? 'double-click' : 'selection';

    lastSelection = {
      word: data.word,
      context: data.context,
      pageType: data.pageType,
      learningHistory: data.learningHistory,
      url: data.url,
    };

    if (sender.tab) {
      const shouldOpenForSelection = trigger === 'selection' && autoOpenOnSelection;
      const shouldOpenForDoubleClick = trigger === 'double-click';

      if (shouldOpenForSelection || shouldOpenForDoubleClick) {
        openSidePanelFromMessageSender(sender);

        // A strong-intent double-click should re-enable auto-open behavior
        // even if the user previously closed the side panel.
        if (shouldOpenForDoubleClick) {
          setAutoOpenOnSelection(true);
        }
      }
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
  // Explicitly opening the side panel via the action icon is a clear
  // signal that the user wants the helper available, so we re-enable
  // auto-open-on-selection.
  setAutoOpenOnSelection(true);
});
