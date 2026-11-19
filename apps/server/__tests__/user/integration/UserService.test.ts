import { RoleEnum } from '@cert-it/shared';
import { afterEach, describe, expect, test } from 'vite-plus/test';
import { PasswordHasher } from '../../../src/auth/password/PasswordHasher';
import type { DatabaseService } from '../../../src/database/DatabaseService';
import { UserService } from '../../../src/user/UserService';
import type { NormalizedEmail } from '../../../src/util/email/NormalizedEmail';
import { createTestDatabase } from '../../database/mocks/createTestDatabase';
import { MockSeeder } from '../../database/mocks/MockSeeder';

const passwords = new PasswordHasher();
const databases: DatabaseService[] = [];

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
});

function setup() {
  const database = createTestDatabase();
  databases.push(database);

  const lines: string[] = [];
  const service = new UserService({
    database,
    passwords,
    firstAdminEmail: ' Admin@Example.org ',
    log: (line) => lines.push(line),
  });

  return { database, lines, service };
}

describe('UserService (start)', () => {
  test('GIVEN no users WHEN starting THEN creates an Admin that must change its password', async () => {
    const { database, service } = setup();

    await service.start();
    const admin = database
      .getRepositories()
      .users.findByEmail('admin@example.org' as NormalizedEmail);

    expect(admin).toMatchObject({
      role: RoleEnum.Admin,
      active: true,
      mustChangePassword: true,
    });
  });

  test('GIVEN no users WHEN starting THEN logs a password that matches the stored hash', async () => {
    const { database, lines, service } = setup();

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
    const { database, lines, service } = setup();
    new MockSeeder(database.getRepositories()).user({ active: false });

    await service.start();

    expect(database.getRepositories().users.count()).toBe(1);
    expect(lines).toEqual([]);
  });
});
