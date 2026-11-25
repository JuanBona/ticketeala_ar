// Route guard: only signed-in employees see the panel; the rest go to /login.
import type { ReactNode } from 'react';
import { Navigate } from 'react-router';
import { useAuth } from './AuthProvider.js';
import { PageSkeleton } from '../components/PageSkeleton.js';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { state } = useAuth();
  if (state.status === 'checking') {
    return <PageSkeleton />;
  }
  if (state.status === 'signedOut') {
    return <Navigate to="/login" replace />;
  }
  return children;
}
