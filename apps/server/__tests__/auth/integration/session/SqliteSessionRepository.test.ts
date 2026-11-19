import type { SqliteDatabase } from '@cert-it/data';
import { afterEach, beforeEach, describe, expect, test } from 'vite-plus/test';
import type { User } from '../../../../src/user/User';
import type { Repositories } from '../../../../src/database/Repositories';
import { createTestDatabase } from '../../../database/mocks/createTestDatabase';
import { MockSeeder } from '../../../database/mocks/MockSeeder';

const Now = new Date('2026-11-18T12:00:00.000Z');

let database: SqliteDatabase<Repositories>;
let repositories: Repositories;
let seeder: MockSeeder;
let user: User;

beforeEach(() => {
  database = createTestDatabase();
  repositories = database.getRepositories();
  seeder = new MockSeeder(repositories);
  user = seeder.user();
});

afterEach(() => {
  database.close();
});

function createSession(tokenHash: string, expiresAt: Date, owner = user) {
  return repositories.sessions
    .create({ tokenHash, userId: owner.id, expiresAt })
    .unwrap();
}

describe('SqliteSessionRepository (findByTokenHash)', () => {
  test('GIVEN a session WHEN finding by its token hash THEN returns it', () => {
    const session = createSession('hash-a', Now);

    expect(repositories.sessions.findByTokenHash('hash-a')).toEqual(session);
    expect(session.expiresAt).toEqual(Now);
  });

  test('GIVEN no session with the token hash WHEN finding THEN returns null', () => {
    expect(repositories.sessions.findByTokenHash('missing')).toBeNull();
  });
});

describe('SqliteSessionRepository (deleteExpired)', () => {
  test('GIVEN expired and valid sessions WHEN deleting expired ones THEN keeps only the valid ones', () => {
    createSession('past', new Date(Now.getTime() - 1));
    createSession('now', Now);
    const valid = createSession('future', new Date(Now.getTime() + 1));

    expect(repositories.sessions.deleteExpired(Now)).toBe(2);
    expect(repositories.sessions.findByTokenHash('future')).toEqual(valid);
    expect(repositories.sessions.findByTokenHash('past')).toBeNull();
  });
});

describe('SqliteSessionRepository (deleteByUser)', () => {
  test('GIVEN sessions of two users WHEN deleting those of one THEN keeps the other user sessions', () => {
    const other = seeder.user();
    createSession('a1', Now);
    createSession('a2', Now);
    createSession('b1', Now, other);

    expect(repositories.sessions.deleteByUser(user.id)).toBe(2);
    expect(repositories.sessions.findByTokenHash('b1')).not.toBeNull();
  });
});
