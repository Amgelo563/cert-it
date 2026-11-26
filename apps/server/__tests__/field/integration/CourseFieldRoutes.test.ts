import {
  ApiErrorCodeEnum,
  AuditActionEnum,
  AuditEntityEnum,
  type CourseFieldSummary,
  CourseFieldTypeEnum,
  MaxCourseFields,
  RoleEnum,
  type TemplateContent,
  TemplateFieldTypeEnum,
  courseFieldTemplateType,
} from '@cert-it/shared';
import type { Template } from '@pdfme/common';
import { afterEach, describe, expect, test } from 'vite-plus/test';
import type { DatabaseService } from '../../../src/database/DatabaseService';
import { createTestDatabase } from '../../database/mocks/createTestDatabase';
import { MockSeeder } from '../../database/mocks/MockSeeder';
import { createApiHarness } from '../../http/mocks/createApiHarness';

const databases: DatabaseService[] = [];

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
});

// an Editor logged in through the API, with a course
async function setup() {
  const database = createTestDatabase();
  databases.push(database);
  const harness = createApiHarness(database);
  const editor = await harness.loginAs({ role: RoleEnum.Editor });
  const seeder = new MockSeeder(database.getRepositories());
  const course = seeder.course();
  const fields = (method: string, path = '', body?: unknown) =>
    harness.request(method, `/courses/${course.id}/fields${path}`, {
      cookie: editor.cookie,
      body,
    });
  const add = async (body: Record<string, unknown>) => {
    const response = await fields('POST', '', body);
    return {
      status: response.status,
      body: (await response.json()) as CourseFieldSummary & { error?: string },
    };
  };
  const audits = () =>
    database
      .getRepositories()
      .auditLog.list({ page: 1, size: 50 })
      .items.filter((entry) => entry.entity === AuditEntityEnum.CourseField);

  return { audits, add, course, database, editor, fields, seeder };
}

// the seeded template, plus a field that prints the course field
function printing(fieldId: number): Omit<Template, 'basePdf'> {
  const [page = []] = (MockSeeder.NamedTemplate as TemplateContent).schemas;
  return {
    schemas: [
      [
        ...page,
        {
          name: 'Group',
          type: courseFieldTemplateType(
            TemplateFieldTypeEnum.FieldText,
            fieldId,
          ),
          position: { x: 0, y: 40 },
          width: 50,
          height: 10,
          fontName: page[0]?.['fontName'],
        },
      ],
    ],
  };
}

describe('CourseFieldRoutes (add)', () => {
  test('GIVEN a label and type WHEN adding THEN answers the field after the others, and audits it', async () => {
    const { add, audits, course } = await setup();

    await add({ label: 'Group', type: CourseFieldTypeEnum.Text });
    const { status, body } = await add({
      label: ' Grade ',
      type: CourseFieldTypeEnum.Number,
      required: true,
    });

    expect(status).toBe(201);
    expect(body).toEqual({
      id: expect.any(Number),
      courseId: course.id,
      label: 'Grade',
      type: CourseFieldTypeEnum.Number,
      required: true,
      position: 1,
      valueCount: 0,
    });
    expect(audits().map((entry) => entry.action)).toEqual([
      AuditActionEnum.Create,
      AuditActionEnum.Create,
    ]);
  });

  test('GIVEN a label taken but for case and accents WHEN adding THEN answers 409', async () => {
    const { add } = await setup();
    await add({ label: 'Graduación', type: CourseFieldTypeEnum.Text });

    const { status, body } = await add({
      label: 'GRADUACION',
      type: CourseFieldTypeEnum.Date,
    });

    expect(status).toBe(409);
    expect(body.error).toBe(ApiErrorCodeEnum.FieldLabelTaken);
  });

  test('GIVEN a label over 20 characters WHEN adding THEN answers 400', async () => {
    const { add } = await setup();

    const { status } = await add({
      label: 'a'.repeat(21),
      type: CourseFieldTypeEnum.Text,
    });

    expect(status).toBe(400);
  });

  test('GIVEN a course with the most fields WHEN adding one more THEN answers 409', async () => {
    const { add, course, seeder } = await setup();
    for (let i = 0; i < MaxCourseFields; i += 1) seeder.field(course);

    const { status, body } = await add({
      label: 'One more',
      type: CourseFieldTypeEnum.Text,
    });

    expect(status).toBe(409);
    expect(body.error).toBe(ApiErrorCodeEnum.TooManyFields);
  });
});

describe('CourseFieldRoutes (update)', () => {
  test('GIVEN a field with values WHEN changing its type THEN answers 409 and keeps it', async () => {
    const { course, database, fields, seeder } = await setup();
    const field = seeder.field(course);
    seeder.participant(course, { fieldValues: { [field.id]: 'A' } });

    const response = await fields('PATCH', `/${field.id}`, {
      type: CourseFieldTypeEnum.Number,
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: ApiErrorCodeEnum.FieldHasValues,
    });
    expect(
      database.getRepositories().courseFields.findById(field.id)?.type,
    ).toBe(CourseFieldTypeEnum.Text);
  });

  test('GIVEN a field with values WHEN renaming it and making it required THEN answers the field with its count', async () => {
    const { course, fields, seeder } = await setup();
    const field = seeder.field(course);
    seeder.participant(course, { fieldValues: { [field.id]: 'A' } });

    const response = await fields('PATCH', `/${field.id}`, {
      label: 'Section',
      required: true,
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      label: 'Section',
      required: true,
      valueCount: 1,
    });
  });

  test('GIVEN a printed text field without values WHEN making it an image THEN removes it from the unused template version in place', async () => {
    const { course, database, editor, fields, seeder } = await setup();
    const field = seeder.field(course);
    seeder.templateVersion(course, editor.user, printing(field.id));

    const response = await fields('PATCH', `/${field.id}`, {
      type: CourseFieldTypeEnum.Image,
    });

    expect(response.status).toBe(200);
    const latest = database
      .getRepositories()
      .templateVersions.findLatest(course.id);
    expect(latest?.version).toBe(1);
    const names = (template: unknown) =>
      (template as TemplateContent).schemas[0]?.map((placed) => placed.name);
    expect(names(latest?.template)).toEqual(names(MockSeeder.NamedTemplate));
  });

  test('GIVEN a field of another course WHEN updating it THEN answers 404', async () => {
    const { fields, seeder } = await setup();
    const other = seeder.field(seeder.course());

    const response = await fields('PATCH', `/${other.id}`, { label: 'X' });

    expect(response.status).toBe(404);
  });
});

describe('CourseFieldRoutes (order)', () => {
  test('GIVEN every field in a new order WHEN reordering THEN answers them in that order', async () => {
    const { course, fields, seeder } = await setup();
    const a = seeder.field(course, { label: 'A' });
    const b = seeder.field(course, { label: 'B' });
    const c = seeder.field(course, { label: 'C' });

    const response = await fields('PUT', '/order', { ids: [c.id, a.id, b.id] });

    expect(response.status).toBe(200);
    const listed = (await response.json()) as CourseFieldSummary[];
    expect(listed.map((field) => [field.label, field.position])).toEqual([
      ['C', 0],
      ['A', 1],
      ['B', 2],
    ]);
  });

  test.each([
    { case: 'a field left out', ids: (a: number) => [a] },
    { case: 'a repeated field', ids: (a: number, b: number) => [a, b, a] },
    { case: 'an unknown field', ids: (a: number) => [a, 999] },
  ])('GIVEN $case WHEN reordering THEN answers 400', async ({ ids }) => {
    const { course, fields, seeder } = await setup();
    const a = seeder.field(course);
    const b = seeder.field(course);

    const response = await fields('PUT', '/order', { ids: ids(a.id, b.id) });

    expect(response.status).toBe(400);
  });
});

describe('CourseFieldRoutes (delete)', () => {
  test('GIVEN a printed field with values and an issued certificate WHEN deleting it THEN removes the values, saves a template version without it and audits both', async () => {
    const { audits, course, database, editor, fields, seeder } = await setup();
    const field = seeder.field(course, { label: 'Group' });
    const kept = seeder.field(course, { label: 'City' });
    const ada = seeder.participant(course, {
      fieldValues: { [field.id]: 'A', [kept.id]: 'Lima' },
    });
    const version = seeder.templateVersion(
      course,
      editor.user,
      printing(field.id),
    );
    seeder.certificate(ada, version);

    const response = await fields('DELETE', `/${field.id}`);

    expect(response.status).toBe(204);
    const repositories = database.getRepositories();
    expect(repositories.courseFields.findById(field.id)).toBeNull();
    expect(repositories.participants.findById(ada.id)?.fieldValues).toEqual({
      [kept.id]: 'Lima',
    });
    expect(repositories.templateVersions.findLatest(course.id)?.version).toBe(
      2,
    );
    expect(audits().at(-1)).toMatchObject({
      action: AuditActionEnum.Delete,
      details: {
        courseId: course.id,
        label: 'Group',
        values: 1,
        templateVersion: 2,
      },
    });
  });

  test("GIVEN a field the template doesn't print WHEN deleting it THEN keeps the template version", async () => {
    const { course, database, editor, fields, seeder } = await setup();
    const field = seeder.field(course);
    seeder.templateVersion(course, editor.user);

    await fields('DELETE', `/${field.id}`);

    expect(
      database.getRepositories().templateVersions.findLatest(course.id)
        ?.version,
    ).toBe(1);
  });
});
