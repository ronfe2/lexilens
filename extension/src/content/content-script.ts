import { detectPageType, getSentenceContaining } from '../shared/utils';

console.log('LexiLens content script loaded');

let selectedText = '';
let selectedContext = '';

document.addEventListener('mouseup', () => {
  const selection = window.getSelection();
  const text = selection?.toString().trim();
  
  if (text && text.length > 0 && text.length < 100) {
    selectedText = text;
    const pageText = document.body.innerText;
    selectedContext = getSentenceContaining(text, pageText);
    
    const pageType = detectPageType(window.location.href);
    
    chrome.runtime.sendMessage({
      type: 'WORD_SELECTED',
      data: {
        word: selectedText,
        context: selectedContext,
        pageType,
        url: window.location.href,
      },
    });
  }
});

document.addEventListener('dblclick', () => {
  const selection = window.getSelection();
  const text = selection?.toString().trim();
  
  if (text && text.length > 0) {
    selectedText = text;
    const pageText = document.body.innerText;
    selectedContext = getSentenceContaining(text, pageText);
    
    const pageType = detectPageType(window.location.href);
    
    chrome.runtime.sendMessage({
      type: 'WORD_SELECTED',
      data: {
        word: selectedText,
        context: selectedContext,
        pageType,
        url: window.location.href,
      },
    });
  }
});
