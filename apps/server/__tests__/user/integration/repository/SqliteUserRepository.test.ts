import type { DatabaseService } from '../../../../src/database/DatabaseService';
import { RoleEnum } from '@cert-it/shared';
import { afterEach, beforeEach, describe, expect, test } from 'vite-plus/test';
import type { Repositories } from '../../../../src/database/Repositories';
import { createTestDatabase } from '../../../database/mocks/createTestDatabase';
import { MockSeeder } from '../../../database/mocks/MockSeeder';
import { normalizeEmail } from '../../../../src/util/email/NormalizedEmail';

let database: DatabaseService;
let repositories: Repositories;
let seeder: MockSeeder;

beforeEach(() => {
  database = createTestDatabase();
  repositories = database.getRepositories();
  seeder = new MockSeeder(repositories);
});

afterEach(() => {
  database.close();
});

describe('SqliteUserRepository (create)', () => {
  test('GIVEN valid values WHEN creating THEN returns the user without its password hash', () => {
    const user = repositories.users
      .create({
        email: normalizeEmail('Ada@Example.org '),
        passwordHash: 'secret-hash',
        role: RoleEnum.Admin,
      })
      .unwrap();

    expect(user).toEqual({
      id: user.id,
      email: 'ada@example.org',
      role: RoleEnum.Admin,
      active: true,
      mustChangePassword: true,
      createdAt: expect.any(Date),
    });
    expect(user).not.toHaveProperty('passwordHash');
  });

  test('GIVEN an existing email WHEN creating THEN returns a DuplicateModelError on email', () => {
    const existing = seeder.user();

    const result = repositories.users.create({
      email: existing.email,
      passwordHash: 'hash',
      role: RoleEnum.Viewer,
    });

    expect(result.isErr() && result.error.isOn('email')).toBe(true);
  });
});

describe('SqliteUserRepository (findByEmail)', () => {
  test('GIVEN a user WHEN finding by its email THEN returns it', () => {
    const user = seeder.user();

    expect(repositories.users.findByEmail(user.email)).toEqual(user);
  });

  test('GIVEN no user with the email WHEN finding THEN returns null', () => {
    expect(
      repositories.users.findByEmail(normalizeEmail('nobody@example.org')),
    ).toBeNull();
  });
});

describe('SqliteUserRepository (findPasswordHash)', () => {
  test('GIVEN a user WHEN finding its password hash THEN returns it', () => {
    const user = seeder.user();
    repositories.users.update(user.id, { passwordHash: 'new-hash' }).unwrap();

    expect(repositories.users.findPasswordHash(user.id)).toBe('new-hash');
  });

  test('GIVEN no user with the ID WHEN finding its password hash THEN returns null', () => {
    const user = seeder.user();

    expect(
      repositories.users.findPasswordHash((user.id + 1) as typeof user.id),
    ).toBeNull();
  });
});

describe('SqliteUserRepository (count)', () => {
  test('GIVEN active and inactive users WHEN counting THEN counts all of them', () => {
    seeder.user();
    seeder.user({ active: false });

    expect(repositories.users.count()).toBe(2);
  });

  test('GIVEN admins and other roles WHEN counting active admins THEN skips inactive admins and other roles', () => {
    seeder.user({ role: RoleEnum.Admin });
    seeder.user({ role: RoleEnum.Admin, active: false });
    seeder.user({ role: RoleEnum.Editor });

    expect(repositories.users.countActiveAdmins()).toBe(1);
  });
});

describe('SqliteUserRepository (list)', () => {
  test('GIVEN several users WHEN listing THEN sorts them by email', () => {
    const emails = ['c@example.org', 'a@example.org', 'b@example.org'];
    for (const email of emails) {
      repositories.users
        .create({
          email: normalizeEmail(email),
          passwordHash: 'hash',
          role: RoleEnum.Viewer,
        })
        .unwrap();
    }

    const page = repositories.users.list({ page: 1, size: 10 });

    expect(page.items.map((user) => user.email)).toEqual(emails.toSorted());
    expect(page.total).toBe(3);
  });
});
