import { SiteUrl } from '@cert-it/hono';
import {
  type ApiPage,
  AuditActionEnum,
  AuditEntityEnum,
  type AuditEntrySummary,
  RoleEnum,
} from '@cert-it/shared';
import { afterEach, describe, expect, test } from 'vite-plus/test';
import { AuditLogService } from '../../../src/audit/AuditLogService';
import { AuthGuard } from '../../../src/auth/AuthGuard';
import { SessionService } from '../../../src/auth/session/SessionService';
import type { DatabaseService } from '../../../src/database/DatabaseService';
import { createTestDatabase } from '../../database/mocks/createTestDatabase';
import { MockSeeder } from '../../database/mocks/MockSeeder';
import { createApiHarness } from '../../http/mocks/createApiHarness';

const databases: DatabaseService[] = [];

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
});

function createDatabase(): DatabaseService {
  const database = createTestDatabase();
  databases.push(database);
  return database;
}

// an Admin logged in through the API, which records a login entry
async function setupRoutes() {
  const database = createDatabase();
  const harness = createApiHarness(database);
  const admin = await harness.loginAs({
    email: 'admin@example.org',
    role: RoleEnum.Admin,
  });
  const audit = (query = '') =>
    harness.request('GET', `/audit${query}`, { cookie: admin.cookie });

  return { ...harness, admin, audit, database };
}

describe('AuditLogService (record)', () => {
  test('GIVEN an entry WHEN recording it THEN stores it with empty details by default', () => {
    const database = createDatabase();
    const sessions = new SessionService({
      database,
      siteUrl: new SiteUrl({ baseUrl: 'https://certs.example.org' }),
    });
    const service = new AuditLogService({
      database,
      guard: new AuthGuard({ sessions }),
    });
    const user = new MockSeeder(database.getRepositories()).user();

    const entry = service.record({
      userId: user.id,
      action: AuditActionEnum.Update,
      entity: AuditEntityEnum.User,
      entityId: user.id,
    });

    expect(
      database.getRepositories().auditLog.list({ page: 1, size: 10 }),
    ).toMatchObject({ total: 1, items: [{ id: entry.id, details: {} }] });
  });
});

describe('AuditLogService (access)', () => {
  test.each([RoleEnum.Editor, RoleEnum.Viewer])(
    'GIVEN the %s role WHEN listing the audit log THEN answers 403',
    async (role) => {
      const harness = createApiHarness(createDatabase());
      const { cookie } = await harness.loginAs({ role });

      const response = await harness.request('GET', '/audit', { cookie });

      expect(response.status).toBe(403);
    },
  );

  test('GIVEN no session WHEN listing the audit log THEN answers 401', async () => {
    const harness = createApiHarness(createDatabase());

    expect((await harness.request('GET', '/audit')).status).toBe(401);
  });
});

describe('AuditLogService (list)', () => {
  test('GIVEN a login and two updates WHEN listing a page THEN answers them newest first', async () => {
    const { admin, audit, database } = await setupRoutes();
    for (const entityId of [101, 102]) {
      database
        .getRepositories()
        .auditLog.create({
          userId: admin.user.id,
          action: AuditActionEnum.Update,
          entity: AuditEntityEnum.User,
          entityId,
          details: { active: false },
        })
        .unwrap();
    }

    const response = await audit('?page=1&size=2');
    const page = (await response.json()) as ApiPage<AuditEntrySummary>;

    expect(response.status).toBe(200);
    expect(page).toMatchObject({ total: 3, page: 1, size: 2 });
    expect(page.items).toEqual([
      {
        id: page.items[0]!.id,
        userId: admin.user.id,
        userEmail: 'admin@example.org',
        action: AuditActionEnum.Update,
        entity: AuditEntityEnum.User,
        entityId: 102,
        entityName: null,
        details: { active: false },
        createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      },
      expect.objectContaining({ entityId: 101 }),
    ]);
  });

  test('GIVEN entries about an existing user and by the app WHEN listing THEN names the user and leaves the app unnamed', async () => {
    const { admin, audit, database } = await setupRoutes();
    database
      .getRepositories()
      .auditLog.create({
        userId: null,
        action: AuditActionEnum.Update,
        entity: AuditEntityEnum.User,
        entityId: admin.user.id,
      })
      .unwrap();

    const page = (await (
      await audit('?size=1')
    ).json()) as ApiPage<AuditEntrySummary>;

    expect(page.items[0]).toMatchObject({
      userId: null,
      userEmail: null,
      entityName: 'admin@example.org',
    });
  });

  test('GIVEN a page size over 100 WHEN listing THEN answers 400', async () => {
    const { audit } = await setupRoutes();

    expect((await audit('?size=500')).status).toBe(400);
  });
});
