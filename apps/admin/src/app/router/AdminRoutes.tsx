import type { ComponentType } from 'react';
import { PermissionEnum } from '@cert-it/shared';
import { Navigate, Outlet, type RouteObject } from 'react-router';
import { CourseTabEnum } from '../../course/CourseTabEnum';
import { RequireCoursePermission } from '../../course/RequireCoursePermission';
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
  children?: RouteObject[],
): RouteObject {
  const route: RouteObject = {
    path: path.slice(1),
    lazy: async () => ({ Component: await load() }),
    children,
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

// a course's tabs, each its own chunk; template and settings only for roles that can change them
const CourseTabRoutes: RouteObject[] = [
  {
    index: true,
    element: <Navigate to={CourseTabEnum.Participants} replace />,
  },
  {
    path: CourseTabEnum.Participants,
    lazy: async () => ({
      Component: (await import('../../course/participants/ParticipantsTab'))
        .ParticipantsTab,
    }),
  },
  {
    path: CourseTabEnum.Certificates,
    lazy: async () => ({
      Component: (await import('../../course/certificates/CertificatesTab'))
        .CertificatesTab,
    }),
  },
  {
    element: (
      <RequireCoursePermission permission={PermissionEnum.EditCourses} />
    ),
    children: [
      {
        // pdfme and antd, several MB, only load on this tab
        path: CourseTabEnum.Template,
        lazy: async () => ({
          Component: (await import('../../course/template/TemplateTab'))
            .TemplateTab,
        }),
      },
      {
        path: CourseTabEnum.Settings,
        lazy: async () => ({
          Component: (await import('../../course/settings/SettingsTab'))
            .SettingsTab,
        }),
      },
    ],
  },
];

// each page is its own chunk
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
            AdminPathEnum.Courses,
            async () => (await import('../../course/CoursesPage')).CoursesPage,
          ),
          page(
            AdminPathEnum.Course,
            async () => (await import('../../course/CoursePage')).CoursePage,
            CourseTabRoutes,
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
