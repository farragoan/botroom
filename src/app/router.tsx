// src/app/router.tsx
import { createBrowserRouter } from 'react-router-dom';
import { SignIn } from '@clerk/react';
import Layout from '@/components/layout/Layout';
import AuthGuard from '@/components/layout/AuthGuard';
import HomePage from '@/pages/HomePage';
import DebatePage from '@/pages/DebatePage';
import HistoryPage from '@/pages/HistoryPage';
import BillingPage from '@/pages/BillingPage';
import NotFoundPage from '@/pages/NotFoundPage';

export const router = createBrowserRouter(
  [
    {
      element: <Layout />,
      children: [
        { path: '/sign-in', element: <SignIn routing="path" path="/sign-in" /> },
        {
          element: <AuthGuard />,
          children: [
            { path: '/', element: <HomePage /> },
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
