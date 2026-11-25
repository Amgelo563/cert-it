import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sql } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, test } from 'vite-plus/test';
import { DatabaseService } from '../../../../src/database/DatabaseService';
import type { User } from '../../../../src/user/User';
import { MockSeeder } from '../../../database/mocks/MockSeeder';

const MigrationsFolder = join(import.meta.dirname, '../../../../drizzle');

// the last migration before certificates had their own status index
const LastLegacyMigration = 3;

let directory: string;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'cert-it-migration-'));
});

afterEach(() => {
  rmSync(directory, { recursive: true, force: true });
});

function createLegacyMigrations(): string {
  const folder = join(directory, 'drizzle');
  cpSync(MigrationsFolder, folder, { recursive: true });

  const journalPath = join(folder, 'meta', '_journal.json');
  const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as {
    entries: { idx: number }[];
  };
  journal.entries = journal.entries.filter(
    (entry) => entry.idx <= LastLegacyMigration,
  );
  writeFileSync(journalPath, JSON.stringify(journal));
  return folder;
}

// three certificates, the last two deleted, as IDs were their indexes
function seedLegacy(path: string): void {
  const database = new DatabaseService({
    path,
    migrationsFolder: createLegacyMigrations(),
  });
  database.start();

  const seeder = new MockSeeder(database.getRepositories());
  const course = seeder.course();
  const executor = database.getExecutor();
  // raw, as the users table of that time lacks columns added since
  executor.run(sql`
    INSERT INTO users (email, password_hash, role, created_at)
    VALUES ('legacy@example.org', 'hash', 'admin', 0)
  `);
  const user = { id: 1 } as User;
  const version = seeder.templateVersion(course, user);
  for (let i = 1; i <= 3; i++) {
    const participant = seeder.participant(course, {
      email: `legacy${i}@example.org`,
    });
    executor.run(sql`
      INSERT INTO certificates (code, course_id, participant_id, template_version_id, issue_date, created_at, updated_at)
      VALUES (${`CODE-000${i}-XX`}, ${course.id}, ${participant.id}, ${version.id}, '2026-11-18', 0, 0)
    `);
  }
  executor.run(sql`DELETE FROM certificates WHERE id IN (2, 3)`);
  database.close();
}

describe('status index migration', () => {
  test('GIVEN certificates issued before WHEN migrating THEN they keep their ID as index and deleted IDs stay revoked', () => {
    const path = join(directory, 'app.db');
    seedLegacy(path);

    const database = new DatabaseService({ path });
    database.start();
    const { certificates } = database.getRepositories();

    expect(certificates.findById(1 as never)?.statusIndex).toBe(1);
    expect(
      certificates.listRevokedStatusIndexes().toSorted((a, b) => a - b),
    ).toEqual([2, 3]);
    expect(certificates.findHighestId()).toBe(3);
    database.close();
  });

  test('GIVEN a migrated database WHEN issuing and deleting THEN new IDs and indexes are not reused and triggers still run', () => {
    const path = join(directory, 'app.db');
    seedLegacy(path);

    const database = new DatabaseService({ path });
    database.start();
    const repositories = database.getRepositories();
    const { certificates } = repositories;
    const versionBefore = certificates.findStatusVersion();
    const seeder = new MockSeeder(repositories);
    const course = repositories.courses.findById(1 as never)!;
    const version = seeder.templateVersion(course, seeder.user());

    const created = seeder.certificate(seeder.participant(course), version);
    certificates.delete(1 as never).unwrap();

    expect(created.id).toBe(4);
    expect([1, 2, 3]).not.toContain(created.statusIndex);
    expect(
      certificates.listRevokedStatusIndexes().toSorted((a, b) => a - b),
    ).toEqual([1, 2, 3]);
    expect(certificates.findStatusVersion()).toBe(versionBefore + 2);
    database.close();
  });
});
