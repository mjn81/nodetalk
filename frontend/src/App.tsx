import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ChannelProvider } from './context/ChannelContext';
import LoginPage    from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import AppPage      from './pages/AppPage';

// Guard: redirect unauthenticated users to /login
function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <span className="spinner" style={{ width: 36, height: 36 }} />
      </div>
    );
  }
  return user ? <>{children}</> : <Navigate to="/login" replace />;
}

// Guard: redirect authenticated users to /
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <span className="spinner" style={{ width: 36, height: 36 }} />
      </div>
    );
  }
  return user ? <Navigate to="/" replace /> : <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={
            <PublicRoute><LoginPage /></PublicRoute>
          } />
          <Route path="/register" element={
            <PublicRoute><RegisterPage /></PublicRoute>
          } />
          <Route path="/*" element={
            <PrivateRoute>
              <ChannelProvider>
                <AppPage />
              </ChannelProvider>
            </PrivateRoute>
          } />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
