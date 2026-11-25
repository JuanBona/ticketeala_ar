// Renders the whole app at a route, with a fresh session, as the browser would.
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { App } from '../App.js';
import { AuthProvider } from '../auth/AuthProvider.js';
import { Session } from '../auth/session.js';

export function renderApp(path: string) {
  const session = new Session(window.sessionStorage);
  render(
    <AuthProvider session={session}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </AuthProvider>,
  );
  return session;
}
