import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  ApiErrorCodeEnum,
  CourseFieldTypeEnum,
  FieldDateOrderEnum,
  FieldValueErrorEnum,
  type ImageUpload,
  type ImportParticipantsResponse,
  type ImportRow,
  ImportRowStatusEnum,
  type ParticipantSummary,
  RoleEnum,
  type TemplateContent,
  TemplateFieldTypeEnum,
  courseFieldTemplateType,
} from '@cert-it/shared';
import type { Template } from '@pdfme/common';
import { afterEach, describe, expect, test } from 'vite-plus/test';
import type { DatabaseService } from '../../../src/database/DatabaseService';
import { DataDirectoryService } from '../../../src/storage/DataDirectoryService';
import { createTestDatabase } from '../../database/mocks/createTestDatabase';
import { MockSeeder } from '../../database/mocks/MockSeeder';
import { TinyPng } from '../../field/mocks/TinyPng';
import { createApiHarness } from '../../http/mocks/createApiHarness';

const databases: DatabaseService[] = [];
const roots: string[] = [];

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

// an Editor logged in through the API, with a course in Spanish and a started data directory
async function setup() {
  const database = createTestDatabase();
  databases.push(database);
  const root = mkdtempSync(join(tmpdir(), 'cert-it-values-'));
  roots.push(root);
  const dataDirectory = DataDirectoryService.create({ root });
  dataDirectory.start();
  const harness = createApiHarness(database, { dataDirectory });
  const editor = await harness.loginAs({ role: RoleEnum.Editor });
  const seeder = new MockSeeder(database.getRepositories());
  const course = seeder.course({ locale: 'es' });
  const send = async (method: string, path: string, body?: unknown) => {
    const response = await harness.request(
      method,
      `/courses/${course.id}${path}`,
      { cookie: editor.cookie, body },
    );
    return { status: response.status, body: (await response.json()) as never };
  };
  const runImport = (
    rows: ImportRow[],
    options: Record<string, unknown> = {},
  ) =>
    send('POST', '/participants/import', {
      mode: 'update',
      dryRun: false,
      rows,
      ...options,
    }) as Promise<{ status: number; body: ImportParticipantsResponse }>;
  const uploadImage = async () =>
    ((await send('POST', '/images', TinyPng)).body as ImageUpload).image;
  const jobs = () =>
    database
      .getRepositories()
      .jobs.listByCourse(course.id, { page: 1, size: 10 })
      .items.map((job) => job.payload);

  return {
    course,
    database,
    editor,
    jobs,
    runImport,
    seeder,
    send,
    uploadImage,
  };
}

function printing(fieldId: number): Omit<Template, 'basePdf'> {
  return {
    schemas: [
      [
        ...((MockSeeder.NamedTemplate as TemplateContent).schemas[0] ?? []),
        {
          name: 'Grade',
          type: courseFieldTemplateType(
            TemplateFieldTypeEnum.FieldText,
            fieldId,
          ),
          position: { x: 0, y: 40 },
          width: 50,
          height: 10,
        },
      ],
    ],
  };
}

describe('ParticipantRoutes (field values)', () => {
  test('GIVEN values of each type WHEN adding a participant THEN stores and answers them', async () => {
    const { course, seeder, send, uploadImage } = await setup();
    const text = seeder.field(course, { type: CourseFieldTypeEnum.Text });
    const number = seeder.field(course, { type: CourseFieldTypeEnum.Number });
    const date = seeder.field(course, { type: CourseFieldTypeEnum.Date });
    const flag = seeder.field(course, { type: CourseFieldTypeEnum.Boolean });
    const photo = seeder.field(course, { type: CourseFieldTypeEnum.Image });
    const image = await uploadImage();

    const { status, body } = await send('POST', '/participants', {
      name: 'Ada',
      email: 'ada@example.org',
      fieldValues: {
        [text.id]: ' A ',
        [number.id]: 18.5,
        [date.id]: '2026-11-24',
        [flag.id]: false,
        [photo.id]: image,
      },
    });

    expect(status).toBe(201);
    expect((body as ParticipantSummary).fieldValues).toEqual({
      [text.id]: 'A',
      [number.id]: 18.5,
      [date.id]: '2026-11-24',
      [flag.id]: false,
      [photo.id]: image,
    });
  });

  test.each([
    { case: 'a number for a text field', type: 'text', value: 3 },
    { case: 'a text for a number field', type: 'number', value: '3' },
    { case: 'an impossible date', type: 'date', value: '2026-02-30' },
    {
      case: 'an image that is not stored',
      type: 'image',
      value: `${'a'.repeat(64)}.png`,
    },
  ] as const)(
    'GIVEN $case WHEN adding THEN answers 422',
    async ({ type, value }) => {
      const { course, seeder, send } = await setup();
      const field = seeder.field(course, { type });

      const { status, body } = await send('POST', '/participants', {
        name: 'Ada',
        email: 'ada@example.org',
        fieldValues: { [field.id]: value },
      });

      expect(status).toBe(422);
      expect(body).toEqual({ error: ApiErrorCodeEnum.InvalidFieldValue });
    },
  );

  test('GIVEN a required field left out WHEN adding THEN answers 422', async () => {
    const { course, seeder, send } = await setup();
    seeder.field(course, { required: true });

    const { status, body } = await send('POST', '/participants', {
      name: 'Ada',
      email: 'ada@example.org',
    });

    expect(status).toBe(422);
    expect(body).toEqual({ error: ApiErrorCodeEnum.FieldRequired });
  });

  test("GIVEN a value of another course's field WHEN adding THEN answers 422", async () => {
    const { seeder, send } = await setup();
    const other = seeder.field(seeder.course());

    const { status, body } = await send('POST', '/participants', {
      name: 'Ada',
      email: 'ada@example.org',
      fieldValues: { [other.id]: 'A' },
    });

    expect(status).toBe(422);
    expect(body).toEqual({ error: ApiErrorCodeEnum.UnknownField });
  });

  test('GIVEN a null value WHEN updating THEN clears it and keeps the rest', async () => {
    const { course, seeder, send } = await setup();
    const group = seeder.field(course);
    const city = seeder.field(course);
    const ada = seeder.participant(course, {
      fieldValues: { [group.id]: 'A', [city.id]: 'Lima' },
    });

    const { status, body } = await send('PATCH', `/participants/${ada.id}`, {
      fieldValues: { [group.id]: null },
    });

    expect(status).toBe(200);
    expect((body as ParticipantSummary).fieldValues).toEqual({
      [city.id]: 'Lima',
    });
  });

  test('GIVEN a required field added later WHEN renaming a participant without it THEN still saves', async () => {
    const { course, seeder, send } = await setup();
    const ada = seeder.participant(course);
    seeder.field(course, { required: true });

    const { status } = await send('PATCH', `/participants/${ada.id}`, {
      name: 'Ada Lovelace',
    });

    expect(status).toBe(200);
  });

  test("GIVEN a certificate that prints a field WHEN its value changes THEN renders it again, and not for a field it doesn't print", async () => {
    const { course, editor, jobs, seeder, send } = await setup();
    const grade = seeder.field(course, { type: CourseFieldTypeEnum.Number });
    const notes = seeder.field(course);
    const version = seeder.templateVersion(
      course,
      editor.user,
      printing(grade.id),
    );
    const ada = seeder.participant(course);
    const certificate = seeder.certificate(ada, version);

    await send('PATCH', `/participants/${ada.id}`, {
      fieldValues: { [notes.id]: 'Late' },
    });
    expect(jobs()).toEqual([]);

    await send('PATCH', `/participants/${ada.id}`, {
      fieldValues: { [grade.id]: 17 },
    });
    expect(jobs()).toEqual([
      { certificateIds: [certificate.id], templateVersionId: version.id },
    ]);
  });
});

describe('ParticipantImport (fields)', () => {
  test("GIVEN typed cells WHEN importing THEN stores them parsed, and reports the cells that can't be read", async () => {
    const { course, database, runImport, seeder } = await setup();
    const grade = seeder.field(course, { type: CourseFieldTypeEnum.Number });
    const honors = seeder.field(course, { type: CourseFieldTypeEnum.Boolean });

    const { body } = await runImport([
      {
        name: 'Ada',
        email: 'ada@example.org',
        fields: { [grade.id]: '18,5', [honors.id]: 'Sí' },
      },
      {
        name: 'Bob',
        email: 'bob@example.org',
        fields: { [grade.id]: 'eighteen', [honors.id]: 'maybe' },
      },
    ]);

    expect(body.rows).toEqual([
      { row: 0, status: ImportRowStatusEnum.Create },
      {
        row: 1,
        status: ImportRowStatusEnum.Invalid,
        fieldErrors: [
          { fieldId: grade.id, error: FieldValueErrorEnum.InvalidNumber },
          { fieldId: honors.id, error: FieldValueErrorEnum.InvalidBoolean },
        ],
      },
    ]);
    const [ada] = database
      .getRepositories()
      .participants.listByCourse(course.id, { page: 1, size: 10 }).items;
    expect(ada?.fieldValues).toEqual({ [grade.id]: 18.5, [honors.id]: true });
  });

  test('GIVEN a date column with a day over 12 WHEN importing THEN reads every date of it day first and reports it', async () => {
    const { course, database, runImport, seeder } = await setup();
    const date = seeder.field(course, { type: CourseFieldTypeEnum.Date });

    const { body } = await runImport([
      {
        name: 'Ada',
        email: 'ada@example.org',
        fields: { [date.id]: '03/04/2026' },
      },
      {
        name: 'Bob',
        email: 'bob@example.org',
        fields: { [date.id]: '24/11/2026' },
      },
    ]);

    expect(body.dateOrders).toEqual({
      [date.id]: FieldDateOrderEnum.DayFirst,
    });
    const values = database
      .getRepositories()
      .participants.listByCourse(course.id, { page: 1, size: 10 })
      .items.map((participant) => participant.fieldValues[date.id]);
    expect(values).toEqual(['2026-04-03', '2026-11-24']);
  });

  test('GIVEN a required field WHEN a new row leaves it empty THEN reports it, but an existing participant with a value passes', async () => {
    const { course, runImport, seeder } = await setup();
    const group = seeder.field(course, { required: true });
    seeder.participant(course, {
      name: 'Ada',
      email: 'ada@example.org',
      fieldValues: { [group.id]: 'A' },
    });

    const { body } = await runImport([
      { name: 'Ada L', email: 'ada@example.org', fields: { [group.id]: '' } },
      { name: 'Bob', email: 'bob@example.org', fields: { [group.id]: ' ' } },
    ]);

    expect(body.rows).toEqual([
      { row: 0, status: ImportRowStatusEnum.Update, existingName: 'Ada' },
      {
        row: 1,
        status: ImportRowStatusEnum.Invalid,
        fieldErrors: [
          { fieldId: group.id, error: FieldValueErrorEnum.Required },
        ],
      },
    ]);
  });

  test("GIVEN image cells WHEN importing THEN echoes the browser's file errors and rejects images not uploaded", async () => {
    const { course, runImport, seeder, uploadImage } = await setup();
    const photo = seeder.field(course, { type: CourseFieldTypeEnum.Image });
    const image = await uploadImage();
    const missing = `${'b'.repeat(64)}.png`;

    const rows: ImportRow[] = [
      { name: 'Ada', email: 'ada@example.org', fields: { [photo.id]: image } },
      {
        name: 'Bob',
        email: 'bob@example.org',
        fields: { [photo.id]: missing },
      },
      {
        name: 'Cy',
        email: 'cy@example.org',
        fields: { [photo.id]: 'cy.jpg' },
        fileErrors: { [photo.id]: FieldValueErrorEnum.ImageAmbiguous },
      },
    ];
    const dryRun = await runImport(rows, { dryRun: true });
    const { body } = await runImport(rows);

    expect(dryRun.body.rows.map((row) => row.status)).toEqual([
      ImportRowStatusEnum.Create,
      ImportRowStatusEnum.Create,
      ImportRowStatusEnum.Invalid,
    ]);
    expect(body.rows.slice(1)).toEqual([
      {
        row: 1,
        status: ImportRowStatusEnum.Invalid,
        fieldErrors: [
          { fieldId: photo.id, error: FieldValueErrorEnum.ImageNotUploaded },
        ],
      },
      {
        row: 2,
        status: ImportRowStatusEnum.Invalid,
        fieldErrors: [
          { fieldId: photo.id, error: FieldValueErrorEnum.ImageAmbiguous },
        ],
      },
    ]);
  });

  test('GIVEN a changed value the certificate prints WHEN importing THEN renders it again', async () => {
    const { course, editor, jobs, runImport, seeder } = await setup();
    const grade = seeder.field(course, { type: CourseFieldTypeEnum.Number });
    const version = seeder.templateVersion(
      course,
      editor.user,
      printing(grade.id),
    );
    const ada = seeder.participant(course, {
      name: 'Ada',
      email: 'ada@example.org',
      fieldValues: { [grade.id]: 15 },
    });
    const certificate = seeder.certificate(ada, version);

    await runImport([
      { name: 'Ada', email: 'ada@example.org', fields: { [grade.id]: '15' } },
    ]);
    expect(jobs()).toEqual([]);

    await runImport([
      { name: 'Ada', email: 'ada@example.org', fields: { [grade.id]: '16' } },
    ]);
    expect(jobs()).toEqual([
      { certificateIds: [certificate.id], templateVersionId: version.id },
    ]);
  });
});
