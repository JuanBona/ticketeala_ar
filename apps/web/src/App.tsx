// Routes of the web panel. Every route except /login requires a session; each screen, its role.
import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { RequireAuth } from './auth/RequireAuth.js';
import { RequireRole } from './auth/RequireRole.js';
import { ApprovalsPage } from './features/approvals/ApprovalsPage.js';
import { HomePage } from './features/home/HomePage.js';
import { LoginPage } from './features/login/LoginPage.js';
import { AppShell } from './features/shell/AppShell.js';

function PanelScreen({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <AppShell>{children}</AppShell>
    </RequireAuth>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <PanelScreen>
            <HomePage />
          </PanelScreen>
        }
      />
      <Route
        path="/aprobaciones"
        element={
          <PanelScreen>
            <RequireRole role="aprobador">
              <ApprovalsPage />
            </RequireRole>
          </PanelScreen>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
