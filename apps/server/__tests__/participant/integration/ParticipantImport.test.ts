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
      .items.map(({ name, email, fieldValues }) => ({
        name,
        email,
        fieldValues,
      }));
  const imports = () =>
    database
      .getRepositories()
      .auditLog.list({ page: 1, size: 50 })
      .items.filter((entry) => entry.action === AuditActionEnum.Import);

  return {
    ...harness,
    course,
    database,
    editor,
    imports,
    runImport,
    seeder,
    stored,
  };
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
      dateOrders: {},
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
      { name: 'Ada', email: 'ada@example.org', fieldValues: {} },
    ]);
  });

  test('GIVEN an existing email WHEN importing in update mode THEN replaces the name and the values the row has', async () => {
    const { course, runImport, seeder, stored } = await setup();
    const group = seeder.field(course, { label: 'Group' });
    const city = seeder.field(course, { label: 'City' });
    const id = seeder.field(course, { label: 'ID', type: 'number' });
    seeder.participant(course, {
      name: 'Ada',
      email: 'ada@example.org',
      fieldValues: { [group.id]: 'A', [city.id]: 'Lima' },
    });

    const { body } = await runImport({
      mode: 'update',
      rows: [
        {
          name: 'Ada Lovelace',
          email: 'ada@example.org',
          fields: { [group.id]: 'B', [id.id]: ' 42 ', [city.id]: '  ' },
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
        fieldValues: { [group.id]: 'B', [city.id]: 'Lima', [id.id]: 42 },
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

describe('ParticipantImport (certificates)', () => {
  // two certificates on each of two versions, and one participant without one
  async function withCertificates() {
    const context = await setup();
    const { course, editor, seeder } = context;
    const first = seeder.templateVersion(course, editor.user);
    const second = seeder.templateVersion(course, editor.user);
    const issue = (email: string, version: typeof first) =>
      seeder.certificate(
        seeder.participant(course, { name: email.split('@')[0], email }),
        version,
      );
    const certificates = {
      ada: issue('ada@example.org', first),
      bob: issue('bob@example.org', first),
      cy: issue('cy@example.org', second),
      dan: issue('dan@example.org', second),
    };
    seeder.participant(course, { name: 'eve', email: 'eve@example.org' });
    const jobs = () =>
      context.database
        .getRepositories()
        .jobs.listByCourse(course.id, { page: 1, size: 10 })
        .items.map((job) => job.payload)
        .reverse();

    return { ...context, certificates, first, jobs, second };
  }

  const rows: ImportRow[] = [
    { name: 'Ada Lovelace', email: 'ada@example.org' },
    { name: 'bob', email: 'bob@example.org' },
    { name: 'Cy Young', email: 'cy@example.org' },
    { name: 'Eve Online', email: 'eve@example.org' },
  ];

  test('GIVEN renamed participants with certificates on two versions WHEN importing in update mode THEN renders them again, one job per version', async () => {
    const { certificates, first, jobs, runImport, second } =
      await withCertificates();

    const { status } = await runImport({ mode: 'update', rows });

    expect(status).toBe(200);
    expect(jobs()).toEqual([
      {
        certificateIds: [certificates.ada.id],
        templateVersionId: first.id,
      },
      {
        certificateIds: [certificates.cy.id],
        templateVersionId: second.id,
      },
    ]);
  });

  test('GIVEN renamed participants with certificates WHEN dry running THEN adds no job', async () => {
    const { jobs, runImport } = await withCertificates();

    await runImport({ mode: 'update', rows, dryRun: true });

    expect(jobs()).toEqual([]);
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
