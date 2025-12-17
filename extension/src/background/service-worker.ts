import type { AnalysisRequest } from '../shared/types';

console.log('LexiLens background service worker loaded');

let lastSelection: AnalysisRequest | null = null;

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

    if (sender.tab?.windowId) {
      chrome.sidePanel.open({ windowId: sender.tab.windowId });
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
  if (tab.id) {
    chrome.sidePanel.open({ windowId: tab.windowId });
  }
});
