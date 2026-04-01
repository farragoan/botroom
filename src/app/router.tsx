import { createBrowserRouter } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import LandingPage from '@/pages/LandingPage';
import HomePage from '@/pages/HomePage';
import DebatePage from '@/pages/DebatePage';
import NotFoundPage from '@/pages/NotFoundPage';

export const router = createBrowserRouter(
  [
    // Landing page — standalone, no app shell
    { path: '/', element: <LandingPage /> },
    // App shell with header/footer
    {
      element: <Layout />,
      children: [
        { path: '/arena', element: <HomePage /> },
        { path: '/debate', element: <DebatePage /> },
        { path: '*', element: <NotFoundPage /> },
      ],
    },
  ],
  { basename: '/' }
);
