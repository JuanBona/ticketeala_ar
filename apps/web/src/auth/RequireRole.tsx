// Screen guard by role (RN29): without the role the screen is not shown; the API rejects the calls anyway.
import type { ReactNode } from 'react';
import { Navigate } from 'react-router';
import type { Role } from './auth-api.js';
import { useAuth } from './AuthProvider.js';

export function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const { state } = useAuth();
  if (state.status !== 'signedIn' || !state.employee.roles.includes(role)) {
    return <Navigate to="/" replace />;
  }
  return children;
}
