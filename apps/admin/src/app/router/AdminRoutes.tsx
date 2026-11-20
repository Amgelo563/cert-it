import type { ComponentType } from 'react';
import { Outlet, type RouteObject } from 'react-router';
import { AuthProvider } from '../../auth/AuthProvider';
import { RequireAuth } from '../../auth/guard/RequireAuth';
import { RequireGuest } from '../../auth/guard/RequireGuest';
import { RequirePermission } from '../../auth/guard/RequirePermission';
import { RouteErrorPage } from '../error/RouteErrorPage';
import { AdminLayout } from '../layout/AdminLayout';
import { PageLoader } from '../layout/PageLoader';
import { AdminPagePermissions } from './AdminPagePermissions';
import { type AdminPath, AdminPathEnum } from './AdminPathEnum';

// a lazy page inside the shell, behind the permission AdminPagePermissions gives it
function page(
  path: AdminPath,
  load: () => Promise<ComponentType>,
): RouteObject {
  const route: RouteObject = {
    path: path.slice(1),
    lazy: async () => ({ Component: await load() }),
  };
  const permission = AdminPagePermissions[path];
  if (!permission) return route;

  return {
    element: (
      <RequirePermission permission={permission}>
        <Outlet />
      </RequirePermission>
    ),
    children: [route],
  };
}

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
          page(
            AdminPathEnum.TemplateDesigner,
            async () =>
              (await import('../../template/designer/TemplateDesignerPage'))
                .TemplateDesignerPage,
          ),
          page(
            AdminPathEnum.Users,
            async () => (await import('../../user/UsersPage')).UsersPage,
          ),
          page(
            AdminPathEnum.AuditLog,
            async () => (await import('../../audit/AuditLogPage')).AuditLogPage,
          ),
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
