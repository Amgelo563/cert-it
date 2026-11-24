import { AuditActionEnum, AuditEntityEnum } from '@cert-it/shared';
import type { DatabaseService } from '../../../../src/database/DatabaseService';
import { afterEach, beforeEach, describe, expect, test } from 'vite-plus/test';
import type { Repositories } from '../../../../src/database/Repositories';
import { createTestDatabase } from '../../../database/mocks/createTestDatabase';
import { MockSeeder } from '../../../database/mocks/MockSeeder';

let database: DatabaseService;
let repositories: Repositories;

beforeEach(() => {
  database = createTestDatabase();
  repositories = database.getRepositories();
});

afterEach(() => {
  database.close();
});

describe('SqliteAuditLogRepository (create)', () => {
  test('GIVEN no user and empty details WHEN creating an entry THEN stores a null user and empty details', () => {
    const entry = repositories.auditLog
      .create({
        userId: null,
        action: AuditActionEnum.Login,
        entity: AuditEntityEnum.User,
        entityId: 1,
        details: {},
      })
      .unwrap();

    expect(entry).toMatchObject({ userId: null, details: {} });
  });
});

describe('SqliteAuditLogRepository (list)', () => {
  test('GIVEN several entries WHEN listing THEN returns the newest first with their details', () => {
    const user = new MockSeeder(repositories).user();
    repositories.auditLog
      .create({
        userId: user.id,
        action: AuditActionEnum.Revoke,
        entity: AuditEntityEnum.Certificate,
        entityId: 7,
        details: { code: 'ABC', reason: 'Typo' },
      })
      .unwrap();
    repositories.auditLog
      .create({
        userId: user.id,
        action: AuditActionEnum.Reinstate,
        entity: AuditEntityEnum.Certificate,
        entityId: 7,
        details: { code: 'ABC' },
      })
      .unwrap();

    const page = repositories.auditLog.list({ page: 1, size: 10 });

    expect(page.items.map(({ action, details }) => [action, details])).toEqual([
      [AuditActionEnum.Reinstate, { code: 'ABC' }],
      [AuditActionEnum.Revoke, { code: 'ABC', reason: 'Typo' }],
    ]);
  });
});
