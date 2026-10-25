// Lazy-loaded wrapper: Clerk (the heaviest dependency) is only fetched for
// authenticated routes, never for the landing page.
import { ClerkProvider } from '@clerk/react';
import { Outlet } from 'react-router-dom';
import { BASE } from '@/lib/constants';

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined;

export default function ClerkShell() {
  if (!publishableKey) {
    return (
      <p className="p-8 text-sm text-zinc-400">
        Sign-in is not configured for this build (VITE_CLERK_PUBLISHABLE_KEY missing).
      </p>
    );
  }
  return (
    <ClerkProvider
      publishableKey={publishableKey}
      signInUrl={`${BASE}/sign-in`}
      signInFallbackRedirectUrl={`${BASE}/arena`}
    >
      <Outlet />
    </ClerkProvider>
  );
}
