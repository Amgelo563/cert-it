import {
  ApiErrorCodeEnum,
  hasPermission,
  type Permission,
  PermissionEnum,
  type Role,
  RoleEnum,
} from '@cert-it/shared';
import { afterEach, describe, expect, test } from 'vite-plus/test';
import type { DatabaseService } from '../../../src/database/DatabaseService';
import { createTestDatabase } from '../../database/mocks/createTestDatabase';
import { createApiHarness } from '../mocks/createApiHarness';

/** Who may call a route: anyone, any logged-in user, or roles with a permission. */
type RouteAccess = 'public' | 'session' | Permission;

/** Every API route; a route missing here fails the test. */
const RouteAccessTable: Readonly<Record<string, RouteAccess>> = {
  'POST /auth/login': 'public',
  'POST /auth/logout': 'public',
  'GET /auth/me': 'session',
  'POST /auth/password': 'session',
  'GET /users': PermissionEnum.ManageUsers,
  'POST /users': PermissionEnum.ManageUsers,
  'PATCH /users/:id': PermissionEnum.ManageUsers,
  'POST /users/:id/reset-password': PermissionEnum.ManageUsers,
  'GET /courses': PermissionEnum.ViewRecords,
  'GET /courses/:id': PermissionEnum.ViewRecords,
  'POST /courses': PermissionEnum.EditCourses,
  'PATCH /courses/:id': PermissionEnum.EditCourses,
  'DELETE /courses/:id': PermissionEnum.DeleteRecords,
  'GET /courses/:courseId/participants': PermissionEnum.ViewRecords,
  'POST /courses/:courseId/participants': PermissionEnum.EditParticipants,
  'PATCH /courses/:courseId/participants/:id': PermissionEnum.EditParticipants,
  'POST /courses/:courseId/participants/import':
    PermissionEnum.EditParticipants,
  'DELETE /courses/:courseId/participants/:id': PermissionEnum.DeleteRecords,
  'GET /courses/:courseId/template': PermissionEnum.ViewRecords,
  'POST /courses/:courseId/template': PermissionEnum.EditCourses,
  'POST /courses/:courseId/template/base-pdf': PermissionEnum.EditCourses,
  'GET /courses/:courseId/template/base-pdf/:sha256':
    PermissionEnum.ViewRecords,
  'GET /fonts': PermissionEnum.ViewRecords,
  'POST /fonts': PermissionEnum.EditCourses,
  'GET /fonts/:sha256': PermissionEnum.ViewRecords,
  'GET /fonts/:sha256/preview': PermissionEnum.ViewRecords,
  'GET /font-catalog': PermissionEnum.EditCourses,
  'POST /font-catalog/import': PermissionEnum.EditCourses,
  'GET /font-catalog/preview': PermissionEnum.EditCourses,
  'GET /audit': PermissionEnum.ViewAuditLog,
};

type Caller =
  | { kind: 'anonymous' }
  | { kind: 'user'; role: Role; mustChangePassword: boolean };

/** A route's answer: let through, or denied with a status and error code. */
type Outcome = 'allowed' | { status: number; error: string };

const Callers: Caller[] = [
  { kind: 'anonymous' },
  ...Object.values(RoleEnum).flatMap((role) =>
    [false, true].map((mustChangePassword): Caller => ({
      kind: 'user',
      role,
      mustChangePassword,
    })),
  ),
];

const databases: DatabaseService[] = [];

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
});

function setup() {
  const database = createTestDatabase();
  databases.push(database);
  return createApiHarness(database);
}

function describeCaller(caller: Caller): string {
  if (caller.kind === 'anonymous') return 'no session';
  return caller.mustChangePassword
    ? `the ${caller.role} role with a pending password change`
    : `the ${caller.role} role`;
}

function expectedFor(access: RouteAccess, caller: Caller): Outcome {
  if (access === 'public') return 'allowed';
  if (caller.kind === 'anonymous') {
    return { status: 401, error: ApiErrorCodeEnum.Unauthorized };
  }
  if (access === 'session') return 'allowed';
  if (caller.mustChangePassword) {
    return { status: 403, error: ApiErrorCodeEnum.PasswordChangeRequired };
  }
  return hasPermission(caller.role, access)
    ? 'allowed'
    : { status: 403, error: ApiErrorCodeEnum.Forbidden };
}

// other errors, such as a 400 for the empty body, mean the guards let it through
async function outcomeOf(response: Response): Promise<Outcome> {
  if (response.status !== 401 && response.status !== 403) return 'allowed';
  const body = (await response.json()) as { error: string };
  return { status: response.status, error: body.error };
}

const cases = Object.entries(RouteAccessTable).flatMap(([route, access]) => {
  const [method = '', path = ''] = route.split(' ');
  return Callers.map((caller) => ({
    route,
    method,
    path,
    caller,
    who: describeCaller(caller),
    expected: expectedFor(access, caller),
  }));
});

describe('API access', () => {
  test('GIVEN the API WHEN listing its routes THEN each one is in the access table', () => {
    const routes = setup().listRoutes();

    expect(routes.toSorted()).toEqual(Object.keys(RouteAccessTable).toSorted());
  });

  test.each(cases)(
    'GIVEN $who WHEN calling $route THEN follows the permission matrix',
    async ({ method, path, caller, expected }) => {
      const harness = setup();
      // another user, so routes on a user id don't hit the caller's own account
      const target = await harness.createUser({ email: 'target@example.org' });
      const cookie =
        caller.kind === 'user'
          ? (
              await harness.loginAs({
                role: caller.role,
                mustChangePassword: caller.mustChangePassword,
              })
            ).cookie
          : undefined;
      const response = await harness.request(
        method,
        path.replaceAll(/:\w+/g, String(target.id)),
        { cookie, body: method === 'GET' ? undefined : {} },
      );

      expect(await outcomeOf(response)).toEqual(expected);
    },
  );
});
