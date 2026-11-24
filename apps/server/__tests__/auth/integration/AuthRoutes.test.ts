import { AuditActionEnum, RoleEnum } from '@cert-it/shared';
import { afterEach, describe, expect, test } from 'vite-plus/test';
import type { DatabaseService } from '../../../src/database/DatabaseService';
import { createTestDatabase } from '../../database/mocks/createTestDatabase';
import {
  type ApiRequestInit,
  ApiHarnessPassword as Password,
  createApiHarness,
} from '../../http/mocks/createApiHarness';
import { sessionCookie } from '../mocks/createAuthApp';

const databases: DatabaseService[] = [];

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
});

// through HttpService, under a base path, so CSRF and caching apply as in production
function setup(options: { maxAttempts?: number } = {}) {
  const database = createTestDatabase();
  databases.push(database);

  const harness = createApiHarness(database, options);
  const request = (method: string, path: string, init?: ApiRequestInit) =>
    harness.request(method, `/auth${path}`, init);
  const login = (body: unknown, ip?: string) =>
    request('POST', '/login', { body, ip });

  return { createUser: harness.createUser, database, login, request };
}

describe('AuthRoutes (login)', () => {
  test('GIVEN the right password WHEN logging in THEN answers the user and sets the session cookie', async () => {
    const { createUser, login } = setup();
    const user = await createUser({ role: RoleEnum.Viewer });

    const response = await login({
      email: ' Ana@Example.org ',
      password: Password,
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('set-cookie')).toContain('Path=/certs');
    expect(await response.json()).toEqual({
      id: user.id,
      email: 'ana@example.org',
      role: RoleEnum.Viewer,
      mustChangePassword: false,
    });
  });

  test('GIVEN a login WHEN reading the audit log THEN records it', async () => {
    const { createUser, database, login } = setup();
    const user = await createUser();

    await login({ email: 'ana@example.org', password: Password });
    const { items } = database
      .getRepositories()
      .auditLog.list({ page: 1, size: 10 });

    expect(items).toMatchObject([
      { userId: user.id, action: AuditActionEnum.Login, entityId: user.id },
    ]);
  });

  test.each([
    { case: 'a wrong password', email: 'ana@example.org', password: 'nope' },
    { case: 'an unknown email', email: 'bob@example.org', password: Password },
  ])(
    'GIVEN $case WHEN logging in THEN answers 401 with no cookie',
    async ({ email, password }) => {
      const { createUser, login } = setup();
      await createUser();

      const response = await login({ email, password });

      expect(response.status).toBe(401);
      expect(response.headers.get('set-cookie')).toBeNull();
      expect(await response.json()).toEqual({ error: 'invalid_credentials' });
    },
  );

  test('GIVEN a deactivated account and its right password WHEN logging in THEN answers like a wrong password', async () => {
    const { createUser, database, login } = setup();
    const user = await createUser();
    database.getRepositories().users.update(user.id, { active: false });

    const response = await login({
      email: 'ana@example.org',
      password: Password,
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'invalid_credentials' });
  });

  test.each([
    { case: 'malformed JSON', body: '{' },
    { case: 'a missing password', body: { email: 'ana@example.org' } },
    {
      case: 'an extra field',
      body: { email: 'ana@example.org', password: Password, role: 'admin' },
    },
  ])('GIVEN $case WHEN logging in THEN answers 400', async ({ body }) => {
    const { login } = setup();

    const response = await login(body);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid_request' });
  });

  test('GIVEN another origin WHEN logging in THEN answers 403 before checking the password', async () => {
    const { createUser, request } = setup();
    await createUser();

    const response = await request('POST', '/login', {
      body: { email: 'ana@example.org', password: Password },
      origin: 'https://evil.example',
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'cross_origin' });
  });
});

describe('AuthRoutes (rate limit)', () => {
  test('GIVEN failed attempts on an account from one IP WHEN logging in from another IP with the right password THEN answers 200', async () => {
    const { createUser, login } = setup({ maxAttempts: 3 });
    await createUser();
    for (let i = 0; i < 5; i++) {
      await login(
        { email: 'ana@example.org', password: 'nope' },
        '198.51.100.1',
      );
    }

    const response = await login(
      { email: 'ana@example.org', password: Password },
      '203.0.113.9',
    );

    expect(response.status).toBe(200);
  });

  test('GIVEN the failed attempts of an account used up from an IP WHEN logging in from it with the right password THEN answers 429', async () => {
    const { createUser, login } = setup({ maxAttempts: 3 });
    await createUser();
    for (let i = 0; i < 3; i++) {
      await login(
        { email: 'ana@example.org', password: 'nope' },
        '198.51.100.1',
      );
    }

    const response = await login(
      { email: 'ana@example.org', password: Password },
      '198.51.100.1',
    );

    expect(response.status).toBe(429);
    expect(Number(response.headers.get('retry-after'))).toBeGreaterThan(0);
    expect(await response.json()).toEqual({ error: 'too_many_attempts' });
  });

  test('GIVEN the attempts of an IP used up on other emails WHEN logging in from it THEN answers 429', async () => {
    const { createUser, login } = setup({ maxAttempts: 3 });
    await createUser();
    for (let i = 0; i < 3; i++) {
      await login({ email: `user${i}@example.org`, password: 'nope' });
    }

    const response = await login({
      email: 'ana@example.org',
      password: Password,
    });

    expect(response.status).toBe(429);
  });

  test('GIVEN failed attempts WHEN a login succeeds THEN the account starts over', async () => {
    const { createUser, login } = setup({ maxAttempts: 3 });
    await createUser();
    await login({ email: 'ana@example.org', password: 'nope' }, '198.51.100.1');
    await login(
      { email: 'ana@example.org', password: Password },
      '198.51.100.2',
    );

    await login({ email: 'ana@example.org', password: 'nope' }, '198.51.100.3');
    const response = await login(
      { email: 'ana@example.org', password: Password },
      '198.51.100.4',
    );

    expect(response.status).toBe(200);
  });
});

describe('AuthRoutes (me and logout)', () => {
  test('GIVEN a session WHEN getting me THEN answers the user, never cached', async () => {
    const { createUser, login, request } = setup();
    const user = await createUser();
    const cookie = sessionCookie(
      await login({ email: 'ana@example.org', password: Password }),
    );

    const response = await request('GET', '/me', { cookie });

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('etag')).toBeNull();
    expect(await response.json()).toMatchObject({ id: user.id });
  });

  test('GIVEN no session WHEN getting me THEN answers 401', async () => {
    const { request } = setup();

    expect((await request('GET', '/me')).status).toBe(401);
  });

  test('GIVEN a session WHEN logging out THEN answers 204 and the session stops working', async () => {
    const { createUser, login, request } = setup();
    await createUser();
    const cookie = sessionCookie(
      await login({ email: 'ana@example.org', password: Password }),
    );

    const response = await request('POST', '/logout', { cookie });

    expect(response.status).toBe(204);
    expect((await request('GET', '/me', { cookie })).status).toBe(401);
  });
});

describe('AuthRoutes (change password)', () => {
  async function loggedIn(mustChangePassword = true) {
    const context = setup();
    const user = await context.createUser({ mustChangePassword });
    const response = await context.login({
      email: 'ana@example.org',
      password: Password,
    });

    return { ...context, user, cookie: sessionCookie(response) };
  }

  test('GIVEN a pending password change WHEN getting me THEN answers the user with the flag', async () => {
    const { cookie, request } = await loggedIn();

    const response = await request('GET', '/me', { cookie });

    expect(await response.json()).toMatchObject({ mustChangePassword: true });
  });

  test('GIVEN the right current password WHEN changing it THEN clears the flag and rotates the session', async () => {
    const { cookie, request } = await loggedIn();

    const response = await request('POST', '/password', {
      cookie,
      body: { currentPassword: Password, newPassword: 'a new long password' },
    });
    const newCookie = sessionCookie(response);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ mustChangePassword: false });
    expect(newCookie).not.toBe(cookie);
    expect((await request('GET', '/me', { cookie })).status).toBe(401);
    expect((await request('GET', '/me', { cookie: newCookie })).status).toBe(
      200,
    );
  });

  test('GIVEN a changed password WHEN logging in THEN only the new one works', async () => {
    const { cookie, login, request } = await loggedIn();
    await request('POST', '/password', {
      cookie,
      body: { currentPassword: Password, newPassword: 'a new long password' },
    });

    const old = await login({ email: 'ana@example.org', password: Password });
    const current = await login({
      email: 'ana@example.org',
      password: 'a new long password',
    });

    expect(old.status).toBe(401);
    expect(current.status).toBe(200);
  });

  test('GIVEN another session of the user WHEN changing the password THEN ends it', async () => {
    const { cookie, login, request } = await loggedIn(false);
    const other = sessionCookie(
      await login({ email: 'ana@example.org', password: Password }),
    );

    await request('POST', '/password', {
      cookie,
      body: { currentPassword: Password, newPassword: 'a new long password' },
    });

    expect((await request('GET', '/me', { cookie: other })).status).toBe(401);
  });

  test('GIVEN a change WHEN reading the audit log THEN records it after the login', async () => {
    const { cookie, database, request, user } = await loggedIn();

    await request('POST', '/password', {
      cookie,
      body: { currentPassword: Password, newPassword: 'a new long password' },
    });
    const { items } = database
      .getRepositories()
      .auditLog.list({ page: 1, size: 10 });

    expect(items.map((entry) => entry.action)).toEqual([
      AuditActionEnum.ChangePassword,
      AuditActionEnum.Login,
    ]);
    expect(items[0]).toMatchObject({ userId: user.id, entityId: user.id });
  });

  test.each([
    {
      case: 'a wrong current password',
      body: { currentPassword: 'nope', newPassword: 'a new long password' },
      error: 'wrong_password',
    },
    {
      case: 'the same password',
      body: { currentPassword: Password, newPassword: Password },
      error: 'same_password',
    },
    {
      case: 'a new password under 10 characters',
      body: { currentPassword: Password, newPassword: 'short' },
      error: 'invalid_request',
    },
  ])(
    'GIVEN $case WHEN changing the password THEN answers 400 and keeps the session',
    async ({ body, error }) => {
      const { cookie, request } = await loggedIn();

      const response = await request('POST', '/password', { cookie, body });

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error });
      expect((await request('GET', '/me', { cookie })).status).toBe(200);
    },
  );

  test('GIVEN failed logins on the account from other IPs WHEN changing the password THEN answers 200', async () => {
    const { cookie, login, request } = await loggedIn();
    for (let i = 0; i < 20; i++) {
      await login(
        { email: 'ana@example.org', password: 'nope' },
        `198.51.100.${i}`,
      );
    }

    const response = await request('POST', '/password', {
      cookie,
      body: { currentPassword: Password, newPassword: 'a new long password' },
    });

    expect(response.status).toBe(200);
  });

  test('GIVEN no session WHEN changing the password THEN answers 401', async () => {
    const { request } = setup();

    const response = await request('POST', '/password', {
      body: { currentPassword: Password, newPassword: 'a new long password' },
    });

    expect(response.status).toBe(401);
  });
});
