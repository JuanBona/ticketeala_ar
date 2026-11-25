// Renders the whole app at a route, with a fresh session, as the browser would.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { App } from '../App.js';
import { AuthProvider } from '../auth/AuthProvider.js';
import { Session } from '../auth/session.js';

export function renderApp(path: string) {
  const session = new Session(window.sessionStorage);
  // No retries in tests: a failing request must show its error at once, not after three attempts.
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider session={session}>
        <MemoryRouter initialEntries={[path]}>
          <App />
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
  return session;
}
