import { type Role, RoleEnum } from '@cert-it/shared';
import { afterEach, describe, expect, test } from 'vite-plus/test';
import type { DatabaseService } from '../../../src/database/DatabaseService';
import { createTestDatabase } from '../../database/mocks/createTestDatabase';
import { MockSeeder } from '../../database/mocks/MockSeeder';
import { createAuthApp, sessionCookie } from '../mocks/createAuthApp';

const SiteOrigin = 'https://certs.example.org';

const databases: DatabaseService[] = [];

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
});

function setup() {
  const database = createTestDatabase();
  databases.push(database);

  const { app } = createAuthApp(database);
  const seeder = new MockSeeder(database.getRepositories());
  const loginAs = async (role: Role, mustChangePassword = false) => {
    const user = seeder.user({ role });
    database
      .getRepositories()
      .users.update(user.id, { mustChangePassword })
      .unwrap();
    const response = await app.request(`/login/${user.id}`, {
      method: 'POST',
      headers: { origin: SiteOrigin },
    });
    return sessionCookie(response);
  };

  return { app, loginAs };
}

describe('AuthGuard (requirePermission)', () => {
  test.each([
    { role: RoleEnum.Admin, status: 200 },
    { role: RoleEnum.Editor, status: 403 },
    { role: RoleEnum.Viewer, status: 403 },
  ])(
    'GIVEN the $role role WHEN opening an Admin-only route THEN answers $status',
    async ({ role, status }) => {
      const { app, loginAs } = setup();
      const cookie = await loginAs(role);

      const response = await app.request('/audit', { headers: { cookie } });

      expect(response.status).toBe(status);
    },
  );

  test('GIVEN a user who must change their password WHEN opening a guarded route THEN answers 403', async () => {
    const { app, loginAs } = setup();
    const cookie = await loginAs(RoleEnum.Admin, true);

    const response = await app.request('/audit', { headers: { cookie } });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: 'password_change_required',
    });
  });

  test('GIVEN no session WHEN opening a guarded route THEN answers 401 before checking the role', async () => {
    const { app } = setup();

    const response = await app.request('/audit');

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'unauthorized' });
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
});

describe('CsrfGuard (middleware)', () => {
  test('GIVEN another Origin WHEN posting THEN answers 403', async () => {
    const { app } = setup();

    const response = await app.request('/logout', {
      method: 'POST',
      headers: { origin: 'https://evil.example' },
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'cross_origin' });
  });

  test('GIVEN the same host over http WHEN posting THEN answers 403', async () => {
    const { app } = setup();

    const response = await app.request('/logout', {
      method: 'POST',
      headers: { origin: 'http://certs.example.org' },
    });

    expect(response.status).toBe(403);
  });

  test('GIVEN neither Origin nor Sec-Fetch-Site WHEN posting THEN answers 403', async () => {
    const { app } = setup();

    expect((await app.request('/logout', { method: 'POST' })).status).toBe(403);
  });

  test('GIVEN no Origin but a same-origin fetch WHEN posting THEN lets it through', async () => {
    const { app } = setup();

    const response = await app.request('/logout', {
      method: 'POST',
      headers: { 'sec-fetch-site': 'same-origin' },
    });

    expect(response.status).toBe(204);
  });

  test('GIVEN another Origin WHEN getting THEN lets it through', async () => {
    const { app } = setup();

    const response = await app.request('/me', {
      headers: { origin: 'https://evil.example' },
    });

    expect(response.status).toBe(401);
  });
});
