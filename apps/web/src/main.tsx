// Web entry point: one session for the whole page, the auth context and the router.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { App } from './App.js';
import { AuthProvider } from './auth/AuthProvider.js';
import { Session } from './auth/session.js';
import './styles/global.css';

const rootElement = document.getElementById('root');
if (rootElement === null) {
  throw new Error('Falta <div id="root"> en index.html');
}

// Created once, outside React, so StrictMode's double effects share the same single-flight refresh.
const session = new Session(window.sessionStorage);

createRoot(rootElement).render(
  <StrictMode>
    <AuthProvider session={session}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
);
