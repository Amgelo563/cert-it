import { AuditActionEnum, AuditEntityEnum } from '@cert-it/shared';
import { afterEach, describe, expect, test } from 'vite-plus/test';
import { AuditLog } from '../../../src/audit/AuditLog';
import type { DatabaseService } from '../../../src/database/DatabaseService';
import { createTestDatabase } from '../../database/mocks/createTestDatabase';
import { MockSeeder } from '../../database/mocks/MockSeeder';

const databases: DatabaseService[] = [];

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
});

describe('AuditLog (record)', () => {
  test('GIVEN an entry WHEN recording it THEN stores it with empty details by default', () => {
    const database = createTestDatabase();
    databases.push(database);
    const auditLog = AuditLog.create({ database });
    const user = new MockSeeder(database.getRepositories()).user();

    const entry = auditLog.record({
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
