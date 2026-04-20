import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useStore } from './store/useStore';
import LoginPage    from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import AppPage      from './pages/AppPage';

/** Full-screen spinner while session is being restored from localStorage */
function LoadingScreen() {
  return (
    <div className="loading-screen">
      <span className="spinner" style={{ width: 36, height: 36 }} />
    </div>
  );
}

/** Redirect to /login when unauthenticated */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const isAuthLoading = useStore(state => state.isAuthLoading);
  const user = useStore(state => state.user);
  const location = useLocation();

  if (isAuthLoading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return <>{children}</>;
}

/** Redirect to app when already authenticated */
function RequireGuest({ children }: { children: React.ReactNode }) {
  const isAuthLoading = useStore(state => state.isAuthLoading);
  const user = useStore(state => state.user);

  if (isAuthLoading) return <LoadingScreen />;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  React.useEffect(() => {
    useStore.getState().initAuth();
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login"    element={<RequireGuest><LoginPage /></RequireGuest>} />
        <Route path="/register" element={<RequireGuest><RegisterPage /></RequireGuest>} />

        {/* Protected app shell */}
        <Route path="/*" element={
          <RequireAuth>
            <AppPage />
          </RequireAuth>
        } />
      </Routes>
    </BrowserRouter>
  );
}
