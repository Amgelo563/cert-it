import type { RouteObject } from 'react-router';
import { RouteErrorPage } from '../error/RouteErrorPage';
import { AdminLayout } from '../layout/AdminLayout';
import { PageLoader } from '../layout/PageLoader';
import { AdminPathEnum } from './AdminPathEnum';

// each page is its own chunk; the Designer's (pdfme + antd, several MB) only loads on its page
export const AdminRoutes: RouteObject[] = [
  {
    path: AdminPathEnum.Home,
    element: <AdminLayout />,
    errorElement: <RouteErrorPage />,
    hydrateFallbackElement: <PageLoader />,
    children: [
      {
        index: true,
        lazy: async () => ({
          Component: (await import('../../home/HomePage')).HomePage,
        }),
      },
      {
        path: AdminPathEnum.TemplateDesigner.slice(1),
        lazy: async () => ({
          Component: (
            await import('../../template/designer/TemplateDesignerPage')
          ).TemplateDesignerPage,
        }),
      },
      {
        path: '*',
        lazy: async () => ({
          Component: (await import('../error/NotFoundPage')).NotFoundPage,
        }),
      },
    ],
  },
];
