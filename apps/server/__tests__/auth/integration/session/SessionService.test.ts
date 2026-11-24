import { RoleEnum } from '@cert-it/shared';
import { afterEach, describe, expect, test } from 'vite-plus/test';
import type { DatabaseService } from '../../../../src/database/DatabaseService';
import { createTestDatabase } from '../../../database/mocks/createTestDatabase';
import { MockSeeder } from '../../../database/mocks/MockSeeder';
import { createAuthApp, sessionCookie } from '../../mocks/createAuthApp';

const Minute = 60_000;
const Origin = { origin: 'https://certs.example.org' };

const databases: DatabaseService[] = [];

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
});

function setup(baseUrl?: string) {
  const database = createTestDatabase();
  databases.push(database);

  // near the real clock, since sessions get created_at from it
  const clock = { now: Date.now() };
  const { app, sessions } = createAuthApp(database, {
    baseUrl,
    now: () => clock.now,
  });
  const user = new MockSeeder(database.getRepositories()).user({
    role: RoleEnum.Admin,
  });

  const login = async () =>
    sessionCookie(
      await app.request(`/login/${user.id}`, {
        method: 'POST',
        headers: Origin,
      }),
    );
  const me = (cookie: string) => app.request('/me', { headers: { cookie } });

  return { app, clock, database, login, me, sessions, user };
}

describe('SessionService (cookie)', () => {
  test('GIVEN HTTPS at the root WHEN reading the cookie THEN it is __Host- prefixed, httpOnly, Secure, Lax and lasts 8 hours', async () => {
    const { app, user } = setup();

    const response = await app.request(`/login/${user.id}`, {
      method: 'POST',
      headers: Origin,
    });
    const cookie = response.headers.get('set-cookie');

    expect(cookie).toMatch(/^__Host-cert-it-session=[\w-]{43};/);
    expect(cookie).toContain('Max-Age=28800');
    expect(cookie).toContain('Path=/');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('SameSite=Lax');
  });

  test('GIVEN a base path over http WHEN logging in THEN the cookie is scoped to it and not Secure', async () => {
    const { app, user } = setup('http://example.org/certs');

    const response = await app.request(`/login/${user.id}`, {
      method: 'POST',
      headers: { origin: 'http://example.org' },
    });
    const cookie = response.headers.get('set-cookie');

    expect(cookie).toMatch(/^cert-it-session=/);
    expect(cookie).toContain('Path=/certs');
    expect(cookie).not.toContain('Secure');
  });

  test('GIVEN a session WHEN logging in again from the same browser THEN the old session ends', async () => {
    const { app, login, me, user } = setup();
    const old = await login();

    const response = await app.request(`/login/${user.id}`, {
      method: 'POST',
      headers: { ...Origin, cookie: old },
    });

    expect(response.status).toBe(204);
    expect((await me(old)).status).toBe(401);
    expect((await me(sessionCookie(response))).status).toBe(200);
  });

  test('GIVEN a login WHEN reading the database THEN stores a hash of the token, not the token', async () => {
    const { database, login, user } = setup();

    const token = (await login()).split('=')[1]!;
    const row = database.getRepositories().sessions.findByTokenHash(token);

    expect(row).toBeNull();
    expect(database.getRepositories().sessions.deleteByUser(user.id)).toBe(1);
  });
});

describe('SessionService (resolve)', () => {
  test('GIVEN a fresh session WHEN requesting THEN returns its user', async () => {
    const { login, me, user } = setup();

    const response = await me(await login());

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ id: user.id });
  });

  test('GIVEN no cookie or an unknown token WHEN requesting THEN answers 401', async () => {
    const { me } = setup();

    expect((await me('')).status).toBe(401);
    expect((await me('__Host-cert-it-session=unknown')).status).toBe(401);
  });

  test('GIVEN 30 idle minutes WHEN requesting THEN answers 401', async () => {
    const { clock, login, me } = setup();
    const cookie = await login();

    clock.now += 30 * Minute;

    expect((await me(cookie)).status).toBe(401);
  });

  test('GIVEN requests every 20 minutes WHEN requesting THEN the idle timeout slides', async () => {
    const { clock, login, me } = setup();
    const cookie = await login();

    for (let i = 0; i < 5; i++) {
      clock.now += 20 * Minute;
      expect((await me(cookie)).status).toBe(200);
    }
  });

  test('GIVEN steady use WHEN 8 hours pass THEN the session ends anyway', async () => {
    const { clock, login, me } = setup();
    const cookie = await login();

    for (let i = 0; i < 23; i++) {
      clock.now += 20 * Minute;
      expect((await me(cookie)).status).toBe(200);
    }
    // 8 hours and 1 minute in, well inside the idle timeout
    clock.now += 21 * Minute;

    expect((await me(cookie)).status).toBe(401);
  });

  test('GIVEN a deactivated user WHEN requesting THEN answers 401 and deletes the session', async () => {
    const { database, login, me, user } = setup();
    const cookie = await login();
    database.getRepositories().users.update(user.id, { active: false });

    expect((await me(cookie)).status).toBe(401);
    expect(database.getRepositories().sessions.deleteByUser(user.id)).toBe(0);
  });
});

describe('SessionService (end)', () => {
  test('GIVEN a session WHEN logging out THEN clears the cookie and the token stops working', async () => {
    const { app, login, me } = setup();
    const cookie = await login();

    const response = await app.request('/logout', {
      method: 'POST',
      headers: { ...Origin, cookie },
    });

    expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
    expect((await me(cookie)).status).toBe(401);
  });

  test('GIVEN two sessions of a user WHEN ending all THEN neither works', async () => {
    const { login, me, sessions, user } = setup();
    const first = await login();
    const second = await login();

    expect(sessions.endAll(user.id)).toBe(2);
    expect((await me(first)).status).toBe(401);
    expect((await me(second)).status).toBe(401);
  });
});

describe('SessionService (deleteExpired)', () => {
  test('GIVEN an idle session WHEN cleaning up THEN deletes it', async () => {
    const { clock, login, sessions } = setup();
    await login();
    clock.now += 31 * Minute;

    expect(sessions.deleteExpired()).toBe(1);
  });
});
