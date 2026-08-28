import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './app/App';
import { RenderErrorBoundary } from './components/layout/RenderErrorBoundary';
import '@xyflow/react/dist/style.css';
import './styles/globals.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element was not found.');
}

createRoot(rootElement).render(
  <StrictMode>
    <RenderErrorBoundary scope="workspace">
      <App />
    </RenderErrorBoundary>
  </StrictMode>,
);
