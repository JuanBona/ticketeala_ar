// Shares who is signed in with every screen and restores the session after a page reload.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { fetchCurrentEmployee, logout, type EmployeeIdentity, type TokenPair } from './auth-api.js';
import type { Session } from './session.js';

export type AuthState =
  | { status: 'checking' }
  | { status: 'signedOut' }
  | { status: 'signedIn'; employee: EmployeeIdentity };

interface AuthContextValue {
  state: AuthState;
  session: Session;
  signIn: (tokens: TokenPair) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function loadEmployee(session: Session): Promise<AuthState> {
  const accessToken = await session.currentAccessToken();
  return { status: 'signedIn', employee: await fetchCurrentEmployee(accessToken) };
}

export function AuthProvider({ session, children }: { session: Session; children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() =>
    session.hasStoredSession() ? { status: 'checking' } : { status: 'signedOut' },
  );

  // After a reload only the refresh token is left: renew the JWT and ask the API who we are.
  useEffect(() => {
    if (state.status !== 'checking') {
      return;
    }
    loadEmployee(session)
      .then(setState)
      .catch((error: unknown) => {
        console.warn('No se pudo recuperar la sesión guardada', error);
        session.clear();
        setState({ status: 'signedOut' });
      });
  }, [session, state.status]);

  const signIn = useCallback(
    async (tokens: TokenPair) => {
      session.start(tokens);
      setState(await loadEmployee(session));
    },
    [session],
  );

  // The screen signs out at once; closing the refresh token in the API (D34) happens behind.
  const signOut = useCallback(async () => {
    const refreshToken = session.clear();
    setState({ status: 'signedOut' });
    if (refreshToken !== null) {
      await logout(refreshToken).catch((error: unknown) => console.warn('No se pudo cerrar la sesión en la API', error));
    }
  }, [session]);

  const value = useMemo(() => ({ state, session, signIn, signOut }), [state, session, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error('useAuth se usó fuera de <AuthProvider>');
  }
  return context;
}
