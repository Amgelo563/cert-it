import { Outlet, type RouteObject } from 'react-router';
import { AuthProvider } from '../../auth/AuthProvider';
import { RequireAuth } from '../../auth/guard/RequireAuth';
import { RequireGuest } from '../../auth/guard/RequireGuest';
import { RouteErrorPage } from '../error/RouteErrorPage';
import { AdminLayout } from '../layout/AdminLayout';
import { PageLoader } from '../layout/PageLoader';
import { AdminPathEnum } from './AdminPathEnum';

// each page is its own chunk; the Designer's (pdfme + antd, several MB) only loads on its page
export const AdminRoutes: RouteObject[] = [
  {
    path: AdminPathEnum.Home,
    element: (
      <AuthProvider>
        <Outlet />
      </AuthProvider>
    ),
    errorElement: <RouteErrorPage />,
    hydrateFallbackElement: <PageLoader />,
    children: [
      {
        element: (
          <RequireGuest>
            <Outlet />
          </RequireGuest>
        ),
        children: [
          {
            path: AdminPathEnum.Login.slice(1),
            lazy: async () => ({
              Component: (await import('../../auth/login/LoginPage')).LoginPage,
            }),
          },
        ],
      },
      {
        element: (
          <RequireAuth allowPendingPasswordChange>
            <Outlet />
          </RequireAuth>
        ),
        children: [
          {
            path: AdminPathEnum.ChangePassword.slice(1),
            lazy: async () => ({
              Component: (
                await import('../../auth/password/ChangePasswordPage')
              ).ChangePasswordPage,
            }),
          },
        ],
      },
      {
        element: (
          <RequireAuth>
            <AdminLayout />
          </RequireAuth>
        ),
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
    ],
  },
];
