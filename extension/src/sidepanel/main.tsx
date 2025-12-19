import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/global.css';

// Establish a long-lived connection so the background script can track
// when the side panel is open or closed and make decisions based on
// whether the helper UI is currently visible.
let sidepanelPort: chrome.runtime.Port | null = null;

try {
  sidepanelPort = chrome.runtime.connect({ name: 'sidepanel' });
} catch (err) {
  // In very old Chrome versions or if the runtime is unavailable, skip
  // connection and let the rest of the UI function normally.
  // eslint-disable-next-line no-console
  console.warn('LexiLens: failed to connect sidepanel port', err);
}

window.addEventListener('beforeunload', () => {
  try {
    sidepanelPort?.disconnect();
  } catch {
    // Ignore disconnect errors; Chrome will clean up the port.
  }
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
