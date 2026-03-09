import { createBrowserRouter } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import HomePage from '@/pages/HomePage';
import DebatePage from '@/pages/DebatePage';
import NotFoundPage from '@/pages/NotFoundPage';

export const router = createBrowserRouter(
  [
    {
      element: <Layout />,
      children: [
        { path: '/', element: <HomePage /> },
        { path: '/debate', element: <DebatePage /> },
        { path: '*', element: <NotFoundPage /> },
      ],
    },
  ],
  { basename: '/botroom' }
);
