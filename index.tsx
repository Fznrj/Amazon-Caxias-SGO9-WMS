import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

console.log('[Entry] Starting React Application...');

const rootElement = document.getElementById('root');

if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<App />);
} else {
  console.error('[Entry] Root element not found!');
}
