// src/app/router.tsx
import { createBrowserRouter } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import AuthGuard from '@/components/layout/AuthGuard';
import LandingPage from '@/pages/LandingPage';
import SignInPage from '@/pages/SignInPage';
import HomePage from '@/pages/HomePage';
import DebatePage from '@/pages/DebatePage';
import HistoryPage from '@/pages/HistoryPage';
import BillingPage from '@/pages/BillingPage';
import NotFoundPage from '@/pages/NotFoundPage';

export const router = createBrowserRouter(
  [
    // Landing page — standalone, no app shell
    { path: '/', element: <LandingPage /> },
    // Sign-in — standalone fullscreen overlay, handles /sign-in/sso-callback sub-routes
    { path: '/sign-in/*', element: <SignInPage /> },
    // App shell with header/footer
    {
      element: <Layout />,
      children: [
        {
          element: <AuthGuard />,
          children: [
            { path: '/arena', element: <HomePage /> },
            { path: '/debate', element: <DebatePage /> },
            { path: '/history', element: <HistoryPage /> },
            { path: '/billing', element: <BillingPage /> },
          ],
        },
        { path: '*', element: <NotFoundPage /> },
      ],
    },
  ],
  { basename: '/' }
);
