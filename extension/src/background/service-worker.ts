console.log('LexiLens background service worker loaded');

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message);
  
  if (message.type === 'WORD_SELECTED') {
    chrome.sidePanel.open({ windowId: sender.tab?.windowId });
  }
  
  sendResponse({ success: true });
  return true;
});

chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    chrome.sidePanel.open({ windowId: tab.windowId });
  }
});
