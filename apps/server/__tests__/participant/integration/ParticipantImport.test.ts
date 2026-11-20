import {
  AuditActionEnum,
  type ImportParticipantsResponse,
  type ImportRow,
  ImportRowErrorEnum,
  ImportRowStatusEnum,
  ImportSkipReasonEnum,
  MaxImportRows,
  RoleEnum,
} from '@cert-it/shared';
import { afterEach, describe, expect, test } from 'vite-plus/test';
import type { DatabaseService } from '../../../src/database/DatabaseService';
import { createTestDatabase } from '../../database/mocks/createTestDatabase';
import { MockSeeder } from '../../database/mocks/MockSeeder';
import { createApiHarness } from '../../http/mocks/createApiHarness';

const databases: DatabaseService[] = [];

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
});

// an Editor logged in through the API, with a course to import into
async function setup() {
  const database = createTestDatabase();
  databases.push(database);
  const harness = createApiHarness(database);
  const editor = await harness.loginAs({ role: RoleEnum.Editor });
  const seeder = new MockSeeder(database.getRepositories());
  const course = seeder.course();
  const runImport = async (body: {
    rows: ImportRow[];
    mode?: string;
    dryRun?: boolean;
  }) => {
    const response = await harness.request(
      'POST',
      `/courses/${course.id}/participants/import`,
      {
        cookie: editor.cookie,
        body: { mode: 'skip', dryRun: false, ...body },
      },
    );
    return {
      status: response.status,
      body: (await response.json()) as ImportParticipantsResponse,
    };
  };
  const stored = () =>
    database
      .getRepositories()
      .participants.listByCourse(course.id, { page: 1, size: 100 })
      .items.map(({ name, email, extra }) => ({ name, email, extra }));
  const imports = () =>
    database
      .getRepositories()
      .auditLog.list({ page: 1, size: 50 })
      .items.filter((entry) => entry.action === AuditActionEnum.Import);

  return { ...harness, course, database, imports, runImport, seeder, stored };
}

describe('ParticipantImport (dry run)', () => {
  test('GIVEN valid, invalid and repeated rows WHEN dry running THEN reports each one and saves nothing', async () => {
    const { imports, runImport, stored } = await setup();

    const { status, body } = await runImport({
      dryRun: true,
      rows: [
        { name: 'Ada', email: 'ada@example.org' },
        { name: '', email: 'nobody' },
        { name: 'Ada again', email: ' ADA@example.org ' },
        { name: 'x'.repeat(201), email: 'long@example.org' },
      ],
    });

    expect(status).toBe(200);
    expect(body).toEqual({
      dryRun: true,
      totals: { create: 1, update: 0, skip: 1, invalid: 2 },
      rows: [
        { row: 0, status: ImportRowStatusEnum.Create },
        {
          row: 1,
          status: ImportRowStatusEnum.Invalid,
          errors: [
            ImportRowErrorEnum.NameRequired,
            ImportRowErrorEnum.EmailInvalid,
          ],
        },
        {
          row: 2,
          status: ImportRowStatusEnum.Skip,
          reason: ImportSkipReasonEnum.DuplicateInFile,
          duplicateOf: 0,
        },
        {
          row: 3,
          status: ImportRowStatusEnum.Invalid,
          errors: [ImportRowErrorEnum.NameTooLong],
        },
      ],
    });
    expect(stored()).toEqual([]);
    expect(imports()).toEqual([]);
  });

  test('GIVEN an invalid row before a valid one with the same email WHEN importing THEN the valid one is created', async () => {
    const { runImport } = await setup();

    const { body } = await runImport({
      rows: [
        { name: '', email: 'ada@example.org' },
        { name: 'Ada', email: 'ada@example.org' },
      ],
    });

    expect(body.rows.map((row) => row.status)).toEqual([
      ImportRowStatusEnum.Invalid,
      ImportRowStatusEnum.Create,
    ]);
  });
});

describe('ParticipantImport (modes)', () => {
  test('GIVEN an existing email WHEN importing in skip mode THEN keeps the participant as is', async () => {
    const { course, runImport, seeder, stored } = await setup();
    seeder.participant(course, { name: 'Ada', email: 'ada@example.org' });

    const { body } = await runImport({
      rows: [{ name: 'Ada Lovelace', email: 'ada@example.org' }],
    });

    expect(body.rows).toEqual([
      {
        row: 0,
        status: ImportRowStatusEnum.Skip,
        reason: ImportSkipReasonEnum.Exists,
        existingName: 'Ada',
      },
    ]);
    expect(stored()).toEqual([
      { name: 'Ada', email: 'ada@example.org', extra: {} },
    ]);
  });

  test('GIVEN an existing email WHEN importing in update mode THEN replaces the name and merges extra columns', async () => {
    const { course, database, runImport, seeder, stored } = await setup();
    const ada = seeder.participant(course, {
      name: 'Ada',
      email: 'ada@example.org',
    });
    database
      .getRepositories()
      .participants.update(ada.id, { extra: { group: 'A', city: 'Lima' } })
      .unwrap();

    const { body } = await runImport({
      mode: 'update',
      rows: [
        {
          name: 'Ada Lovelace',
          email: 'ada@example.org',
          extra: { group: 'B', id: ' 42 ', empty: '  ' },
        },
      ],
    });

    expect(body.rows).toEqual([
      { row: 0, status: ImportRowStatusEnum.Update, existingName: 'Ada' },
    ]);
    expect(stored()).toEqual([
      {
        name: 'Ada Lovelace',
        email: 'ada@example.org',
        extra: { group: 'B', city: 'Lima', id: '42' },
      },
    ]);
  });

  test('GIVEN the same data as stored WHEN importing in update mode THEN skips it as unchanged', async () => {
    const { course, runImport, seeder } = await setup();
    seeder.participant(course, { name: 'Ada', email: 'ada@example.org' });

    const { body } = await runImport({
      mode: 'update',
      rows: [{ name: ' Ada ', email: 'ada@example.org' }],
    });

    expect(body.rows[0]).toMatchObject({
      status: ImportRowStatusEnum.Skip,
      reason: ImportSkipReasonEnum.Unchanged,
    });
  });
});

describe('ParticipantImport (1,000 rows)', () => {
  // 900 new, 50 invalid, 30 repeated in the file and 20 already in the course
  function buildRows(existingEmails: readonly string[]): ImportRow[] {
    const rows: ImportRow[] = [];
    for (let i = 0; i < 900; i += 1) {
      rows.push({
        name: `Participant ${i}`,
        email: `p${i}@example.org`,
        extra: { group: String(i % 7) },
      });
    }
    for (let i = 0; i < 50; i += 1) {
      rows.push(
        i % 2 === 0
          ? { name: '', email: `blank${i}@example.org` }
          : { name: `Bad ${i}`, email: `bad${i}.example.org` },
      );
    }
    for (let i = 0; i < 30; i += 1) {
      rows.push({ name: `Repeated ${i}`, email: `P${i}@Example.org` });
    }
    for (const email of existingEmails) {
      rows.push({ name: `Updated ${email}`, email });
    }
    return rows;
  }

  test('GIVEN a 1,000-row file with errors and duplicates WHEN dry running and importing THEN both report the same and the import saves it', async () => {
    const { course, database, imports, runImport, seeder } = await setup();
    const existing = Array.from({ length: 20 }, (_, i) =>
      seeder.participant(course, { email: `old${i}@example.org` }),
    );
    const rows = buildRows(existing.map((participant) => participant.email));
    const count = () =>
      database
        .getRepositories()
        .participants.listByCourse(course.id, { page: 1, size: 1 }).total;

    const preview = await runImport({ rows, mode: 'update', dryRun: true });
    const countAfterPreview = count();
    const result = await runImport({ rows, mode: 'update' });

    expect(rows).toHaveLength(1000);
    expect(preview.status).toBe(200);
    expect(preview.body.totals).toEqual({
      create: 900,
      update: 20,
      skip: 30,
      invalid: 50,
    });
    expect(countAfterPreview).toBe(20);
    expect(result.body.rows).toEqual(preview.body.rows);
    expect(result.body.dryRun).toBe(false);
    expect(count()).toBe(920);
    expect(imports()).toMatchObject([
      {
        entityId: course.id,
        details: {
          mode: 'update',
          create: 900,
          update: 20,
          skip: 30,
          invalid: 50,
        },
      },
    ]);
  });
});

describe('ParticipantImport (limits)', () => {
  test('GIVEN more rows than allowed WHEN importing THEN answers 400', async () => {
    const { runImport } = await setup();
    const rows = Array.from({ length: MaxImportRows + 1 }, (_, i) => ({
      name: 'A',
      email: `a${i}@example.org`,
    }));

    expect((await runImport({ rows })).status).toBe(400);
  });

  test('GIVEN no rows WHEN importing THEN answers 400', async () => {
    const { runImport } = await setup();

    expect((await runImport({ rows: [] })).status).toBe(400);
  });

  test('GIVEN a missing course WHEN importing THEN answers 404', async () => {
    const { loginAs, request } = await setup();
    const { cookie } = await loginAs({
      email: 'other@example.org',
      role: RoleEnum.Editor,
    });

    const response = await request('POST', '/courses/999/participants/import', {
      cookie,
      body: {
        mode: 'skip',
        dryRun: true,
        rows: [{ name: 'A', email: 'a@b.co' }],
      },
    });

    expect(response.status).toBe(404);
  });
});
