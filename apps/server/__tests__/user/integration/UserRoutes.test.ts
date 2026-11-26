import { SiteUrl } from '@cert-it/hono';
import {
  type ApiPage,
  AuditActionEnum,
  type CreatedUserResponse,
  type ResetPasswordResponse,
  RoleEnum,
  type UserSummary,
} from '@cert-it/shared';
import { afterEach, describe, expect, test } from 'vite-plus/test';
import { AuditLog } from '../../../src/audit/AuditLog';
import { AuthGuard } from '../../../src/auth/AuthGuard';
import { PasswordHasher } from '../../../src/auth/password/PasswordHasher';
import { SessionService } from '../../../src/auth/session/SessionService';
import type { DatabaseService } from '../../../src/database/DatabaseService';
import { UserRoutes } from '../../../src/user/UserRoutes';
import type { NormalizedEmail } from '../../../src/util/email/NormalizedEmail';
import { createTestDatabase } from '../../database/mocks/createTestDatabase';
import { MockSeeder } from '../../database/mocks/MockSeeder';
import { createApiHarness } from '../../http/mocks/createApiHarness';
import { MockLogger } from '../../log/mocks/MockLogger';
import { SystemClock } from '../../../src/clock/SystemClock';

const passwords = new PasswordHasher();
const databases: DatabaseService[] = [];

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
});

function createDatabase(): DatabaseService {
  const database = createTestDatabase();
  databases.push(database);
  return database;
}

function setupStart(firstAdminName?: string) {
  const database = createDatabase();
  const lines: string[] = [];
  const sessions = new SessionService({
    database,
    siteUrl: new SiteUrl({ baseUrl: 'https://certs.example.org' }),
    clock: SystemClock.Instance,
  });
  const guard = new AuthGuard({ sessions });
  const service = new UserRoutes({
    database,
    passwords,
    sessions,
    guard,
    auditLog: new AuditLog({ database }),
    firstAdminEmail: ' Admin@Example.org ',
    firstAdminName,
    placeholderName: 'None',
    logger: new MockLogger({ lines }),
  });

  return { database, lines, service };
}

// an Admin logged in through the API, ready to manage users
async function setupRoutes() {
  const database = createDatabase();
  const harness = createApiHarness(database);
  const admin = await harness.loginAs({
    email: 'admin@example.org',
    role: RoleEnum.Admin,
  });
  const users = (method: string, path: string, body?: unknown) =>
    harness.request(method, `/users${path}`, { cookie: admin.cookie, body });
  const auditActions = () =>
    database
      .getRepositories()
      .auditLog.list({ page: 1, size: 50 })
      .items.filter((entry) => entry.action !== AuditActionEnum.Login)
      .map((entry) => entry.action);

  return { ...harness, admin, auditActions, database, users };
}

describe('UserRoutes (start)', () => {
  test('GIVEN no users WHEN starting THEN creates an Admin that must change its password', async () => {
    const { database, service } = setupStart();

    await service.start();
    const admin = database
      .getRepositories()
      .users.findByEmail('admin@example.org' as NormalizedEmail);

    expect(admin).toMatchObject({
      name: 'None',
      role: RoleEnum.Admin,
      active: true,
      mustChangePassword: true,
    });
  });

  test('GIVEN a first Admin name WHEN starting THEN creates the Admin with it', async () => {
    const { database, service } = setupStart('Ada Lovelace');

    await service.start();
    const admin = database
      .getRepositories()
      .users.findByEmail('admin@example.org' as NormalizedEmail);

    expect(admin?.name).toBe('Ada Lovelace');
  });

  test('GIVEN users without a name WHEN starting THEN gives them the placeholder name', async () => {
    const { database, lines, service } = setupStart();
    const { users } = database.getRepositories();
    const user = new MockSeeder(database.getRepositories()).user();
    users.update(user.id, { name: '' }).unwrap();

    await service.start();

    expect(users.findById(user.id)?.name).toBe('None');
    expect(lines).toHaveLength(1);
  });

  test('GIVEN no users WHEN starting THEN logs a password that matches the stored hash', async () => {
    const { database, lines, service } = setupStart();

    await service.start();
    const { users } = database.getRepositories();
    const admin = users.findByEmail('admin@example.org' as NormalizedEmail)!;
    const password = /password (\S+)/.exec(lines[0]!)?.[1] ?? '';

    expect(lines).toHaveLength(1);
    await expect(
      passwords.verify(users.findPasswordHash(admin.id)!, password),
    ).resolves.toBe(true);
  });

  test('GIVEN an existing user WHEN starting THEN creates nobody and logs nothing', async () => {
    const { database, lines, service } = setupStart();
    new MockSeeder(database.getRepositories()).user({ active: false });

    await service.start();

    expect(database.getRepositories().users.count()).toBe(1);
    expect(lines).toEqual([]);
  });
});

describe('UserRoutes (access)', () => {
  test.each([RoleEnum.Editor, RoleEnum.Viewer])(
    'GIVEN the %s role WHEN listing users THEN answers 403',
    async (role) => {
      const harness = createApiHarness(createDatabase());
      const { cookie } = await harness.loginAs({ role });

      const response = await harness.request('GET', '/users', { cookie });

      expect(response.status).toBe(403);
    },
  );

  test('GIVEN an Admin who must change their password WHEN listing users THEN answers 403', async () => {
    const harness = createApiHarness(createDatabase());
    const { cookie } = await harness.loginAs({
      role: RoleEnum.Admin,
      mustChangePassword: true,
    });

    const response = await harness.request('GET', '/users', { cookie });

    expect(await response.json()).toEqual({
      error: 'password_change_required',
    });
  });
});

describe('UserRoutes (list)', () => {
  test('GIVEN several users WHEN listing a page THEN answers them sorted by email', async () => {
    const { createUser, users } = await setupRoutes();
    await createUser({ email: 'zoe@example.org' });
    await createUser({ email: 'bob@example.org', role: RoleEnum.Viewer });

    const response = await users('GET', '?page=1&size=2');
    const page = (await response.json()) as ApiPage<UserSummary>;

    expect(response.status).toBe(200);
    expect(page).toMatchObject({ total: 3, page: 1, size: 2 });
    expect(page.items).toEqual([
      {
        id: page.items[0]!.id,
        email: 'admin@example.org',
        name: 'Ana',
        role: RoleEnum.Admin,
        active: true,
        mustChangePassword: false,
        createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      },
      expect.objectContaining({ email: 'bob@example.org' }),
    ]);
  });

  test('GIVEN a page size over 100 WHEN listing THEN answers 400', async () => {
    const { users } = await setupRoutes();

    expect((await users('GET', '?size=500')).status).toBe(400);
  });
});

describe('UserRoutes (add)', () => {
  test('GIVEN an email and role WHEN adding a user THEN answers 201 with a password that logs in', async () => {
    const { request, users } = await setupRoutes();

    const response = await users('POST', '', {
      email: ' New@Example.org ',
      name: ' Nora ',
      role: RoleEnum.Viewer,
    });
    const body = (await response.json()) as CreatedUserResponse;
    const login = await request('POST', '/auth/login', {
      body: { email: 'new@example.org', password: body.password },
    });

    expect(response.status).toBe(201);
    expect(body.user).toMatchObject({
      email: 'new@example.org',
      name: 'Nora',
      role: RoleEnum.Viewer,
      mustChangePassword: true,
    });
    expect(login.status).toBe(200);
  });

  test('GIVEN a taken email WHEN adding a user THEN answers 409', async () => {
    const { users } = await setupRoutes();

    const response = await users('POST', '', {
      email: 'ADMIN@example.org',
      name: 'Other',
      role: RoleEnum.Editor,
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'email_taken' });
  });

  test.each([
    {
      case: 'an invalid email',
      body: { email: 'nope', name: 'A', role: 'editor' },
    },
    {
      case: 'an unknown role',
      body: { email: 'a@example.org', name: 'A', role: 'owner' },
    },
    {
      case: 'no name',
      body: { email: 'a@example.org', role: 'editor' },
    },
    {
      case: 'a blank name',
      body: { email: 'a@example.org', name: '   ', role: 'editor' },
    },
  ])('GIVEN $case WHEN adding a user THEN answers 400', async ({ body }) => {
    const { users } = await setupRoutes();

    expect((await users('POST', '', body)).status).toBe(400);
  });

  test('GIVEN a new user WHEN reading the audit log THEN records who added them', async () => {
    const { admin, auditActions, database, users } = await setupRoutes();

    await users('POST', '', {
      email: 'new@example.org',
      name: 'Nora',
      role: 'editor',
    });
    const [entry] = database
      .getRepositories()
      .auditLog.list({ page: 1, size: 1 }).items;

    expect(auditActions()).toEqual([AuditActionEnum.Create]);
    expect(entry).toMatchObject({
      userId: admin.user.id,
      details: { name: 'Nora', role: RoleEnum.Editor },
    });
  });
});

describe('UserRoutes (update)', () => {
  test('GIVEN another user WHEN changing their role THEN answers the updated user and audits it', async () => {
    const { auditActions, createUser, users } = await setupRoutes();
    const editor = await createUser();

    const response = await users('PATCH', `/${editor.id}`, {
      role: RoleEnum.Admin,
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ role: RoleEnum.Admin });
    expect(auditActions()).toEqual([AuditActionEnum.Update]);
  });

  test('GIVEN a logged-in user WHEN deactivating them THEN their session stops working', async () => {
    const { loginAs, request, users } = await setupRoutes();
    const editor = await loginAs();

    const response = await users('PATCH', `/${editor.user.id}`, {
      active: false,
    });

    expect(await response.json()).toMatchObject({ active: false });
    expect(
      (await request('GET', '/auth/me', { cookie: editor.cookie })).status,
    ).toBe(401);
  });

  test('GIVEN a deactivated user WHEN reactivating them THEN they can log in again', async () => {
    const { createUser, request, users } = await setupRoutes();
    const editor = await createUser();
    await users('PATCH', `/${editor.id}`, { active: false });

    await users('PATCH', `/${editor.id}`, { active: true });
    const login = await request('POST', '/auth/login', {
      body: { email: editor.email, password: 'correct horse battery' },
    });

    expect(login.status).toBe(200);
  });

  test('GIVEN another user WHEN renaming them THEN answers the renamed user', async () => {
    const { createUser, users } = await setupRoutes();
    const editor = await createUser();

    const response = await users('PATCH', `/${editor.id}`, { name: ' Eva ' });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ name: 'Eva' });
  });

  test('GIVEN the Admin themself WHEN renaming themself THEN allows it', async () => {
    const { admin, users } = await setupRoutes();

    const response = await users('PATCH', `/${admin.user.id}`, {
      name: 'Ana Admin',
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ name: 'Ana Admin' });
  });

  test('GIVEN the Admin themself WHEN changing their own role THEN answers 409', async () => {
    const { admin, users } = await setupRoutes();

    const response = await users('PATCH', `/${admin.user.id}`, {
      role: RoleEnum.Viewer,
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'own_account' });
  });

  test('GIVEN two active Admins WHEN one demotes the other THEN allows it', async () => {
    const { createUser, users } = await setupRoutes();
    const other = await createUser({ role: RoleEnum.Admin });

    const response = await users('PATCH', `/${other.id}`, {
      role: RoleEnum.Editor,
    });

    expect(response.status).toBe(200);
  });

  test('GIVEN two Admins demoting each other at once WHEN both requests run THEN one answers 409 and an Admin remains', async () => {
    const { admin, database, loginAs, request } = await setupRoutes();
    const other = await loginAs({
      email: 'other@example.org',
      role: RoleEnum.Admin,
    });

    const responses = await Promise.all([
      request('PATCH', `/users/${other.user.id}`, {
        cookie: admin.cookie,
        body: { role: RoleEnum.Editor },
      }),
      request('PATCH', `/users/${admin.user.id}`, {
        cookie: other.cookie,
        body: { role: RoleEnum.Editor },
      }),
    ]);

    expect(
      responses.map((response) => response.status).sort((a, b) => a - b),
    ).toEqual([200, 409]);
    expect(database.getRepositories().users.countActiveAdmins()).toBe(1);
  });

  test.each([
    { case: 'an unknown ID', path: '/999' },
    { case: 'a non-numeric ID', path: '/abc' },
  ])('GIVEN $case WHEN updating THEN answers 404', async ({ path }) => {
    const { users } = await setupRoutes();

    const response = await users('PATCH', path, { active: false });

    expect(response.status).toBe(404);
  });

  test('GIVEN an empty body WHEN updating THEN answers 400', async () => {
    const { createUser, users } = await setupRoutes();
    const editor = await createUser();

    expect((await users('PATCH', `/${editor.id}`, {})).status).toBe(400);
  });
});

describe('UserRoutes (resetPassword)', () => {
  test('GIVEN another user WHEN resetting their password THEN only the new one logs in and they must change it', async () => {
    const { auditActions, loginAs, request, users } = await setupRoutes();
    const editor = await loginAs();

    const response = await users('POST', `/${editor.user.id}/reset-password`);
    const { password } = (await response.json()) as ResetPasswordResponse;
    const oldLogin = await request('POST', '/auth/login', {
      body: { email: editor.user.email, password: 'correct horse battery' },
    });
    const newLogin = await request('POST', '/auth/login', {
      body: { email: editor.user.email, password },
    });

    expect(response.status).toBe(200);
    expect(password).toMatch(/^[\w-]{16}$/);
    expect(
      (await request('GET', '/auth/me', { cookie: editor.cookie })).status,
    ).toBe(401);
    expect(oldLogin.status).toBe(401);
    expect(await newLogin.json()).toMatchObject({ mustChangePassword: true });
    expect(auditActions()).toEqual([AuditActionEnum.ResetPassword]);
  });

  test('GIVEN the Admin themself WHEN resetting their own password THEN answers 409', async () => {
    const { admin, users } = await setupRoutes();

    const response = await users('POST', `/${admin.user.id}/reset-password`);

    expect(response.status).toBe(409);
  });

  test('GIVEN an unknown ID WHEN resetting THEN answers 404', async () => {
    const { users } = await setupRoutes();

    expect((await users('POST', '/999/reset-password')).status).toBe(404);
  });
});
