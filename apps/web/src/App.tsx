// Routes of the web panel. Every route except /login requires a session.
import { Navigate, Route, Routes } from 'react-router';
import { RequireAuth } from './auth/RequireAuth.js';
import { HomePage } from './features/home/HomePage.js';
import { LoginPage } from './features/login/LoginPage.js';

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <HomePage />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
