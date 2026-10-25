// src/app/router.tsx
import { createBrowserRouter } from 'react-router-dom';
import LandingPage from '@/pages/LandingPage';
import { BASE } from '@/lib/constants';

const page = (load: () => Promise<{ default: React.ComponentType }>) => async () => ({
  Component: (await load()).default,
});

export const router = createBrowserRouter(
  [
    // Landing: eager, no Clerk, no app shell
    { path: '/', element: <LandingPage /> },
    // Everything else loads Clerk + the app lazily
    {
      lazy: page(() => import('@/app/ClerkShell')),
      children: [
        { path: '/sign-in/*', lazy: page(() => import('@/pages/SignInPage')) },
        {
          lazy: page(() => import('@/components/layout/Layout')),
          children: [
            {
              lazy: page(() => import('@/components/layout/AuthGuard')),
              children: [
                { path: '/arena', lazy: page(() => import('@/pages/HomePage')) },
                { path: '/debate', lazy: page(() => import('@/pages/DebatePage')) },
                { path: '/history', lazy: page(() => import('@/pages/HistoryPage')) },
              ],
            },
            { path: '*', lazy: page(() => import('@/pages/NotFoundPage')) },
          ],
        },
      ],
    },
  ],
  { basename: BASE || '/' },
);
