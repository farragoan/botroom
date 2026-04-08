// src/components/layout/AuthGuard.tsx
import { useAuth } from '@clerk/react';
import { Navigate, Outlet } from 'react-router-dom';

export default function AuthGuard() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return null; // brief loading flash
  if (!isSignedIn) return <Navigate to="/sign-in" replace />;
  return <Outlet />;
}
