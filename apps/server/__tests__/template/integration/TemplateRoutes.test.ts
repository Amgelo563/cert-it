import { createHash } from 'node:crypto';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  ApiErrorCodeEnum,
  AuditActionEnum,
  AuditEntityEnum,
  type BasePdfUpload,
  type FontSummary,
  RoleEnum,
  type SaveTemplateRequest,
  type TemplateDetail,
} from '@cert-it/shared';
import { afterEach, describe, expect, test } from 'vite-plus/test';
import type { DatabaseService } from '../../../src/database/DatabaseService';
import { DataDirectoryService } from '../../../src/storage/DataDirectoryService';
import { createTestDatabase } from '../../database/mocks/createTestDatabase';
import { MockSeeder } from '../../database/mocks/MockSeeder';
import { readFontFixture } from '../../font/mocks/readFontFixture';
import { createApiHarness } from '../../http/mocks/createApiHarness';
import { createPdf } from '../mocks/createPdf';

const databases: DatabaseService[] = [];
const roots: string[] = [];

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

// an Editor logged in through the API, with a course and a started data directory
async function setup() {
  const database = createTestDatabase();
  databases.push(database);
  const root = mkdtempSync(join(tmpdir(), 'cert-it-templates-'));
  roots.push(root);
  const dataDirectory = DataDirectoryService.create({ root });
  dataDirectory.start();
  const harness = createApiHarness(database, { dataDirectory });
  const editor = await harness.loginAs({ role: RoleEnum.Editor });
  const course = new MockSeeder(database.getRepositories()).course();
  const template = (
    method: string,
    path = '',
    body?: unknown,
    courseId: number = course.id,
  ) =>
    harness.request(method, `/courses/${courseId}/template${path}`, {
      cookie: editor.cookie,
      body,
    });
  const uploadFont = async () =>
    (await (
      await harness.request('POST', '/fonts', {
        cookie: editor.cookie,
        body: readFontFixture('basic.ttf'),
      })
    ).json()) as FontSummary;
  const uploadPdf = async (pages = 1) =>
    (await (
      await template('POST', '/base-pdf', await createPdf(pages))
    ).json()) as BasePdfUpload;

  return { course, database, root, template, uploadFont, uploadPdf };
}

function request(basePdf: string, fontName: string): SaveTemplateRequest {
  return {
    basePdf,
    template: {
      schemas: [
        [
          {
            name: 'Name',
            type: 'participantName',
            position: { x: 20, y: 80 },
            width: 170,
            height: 20,
            fontName,
            fontSize: 32,
          },
          {
            name: 'QR',
            type: 'qrcode',
            position: { x: 170, y: 250 },
            width: 25,
            height: 25,
          },
        ],
      ],
    },
  };
}

describe('TemplateRoutes (base PDF)', () => {
  test('GIVEN a one-page PDF WHEN uploading THEN stores it by hash in the course folder', async () => {
    const { course, root, template } = await setup();
    const pdf = await createPdf();
    const sha256 = createHash('sha256').update(pdf).digest('hex');

    const response = await template('POST', '/base-pdf', pdf);

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      basePdf: sha256,
      bytes: pdf.byteLength,
      large: false,
    });
    expect(readdirSync(join(root, 'templates'))).toEqual([String(course.id)]);
    expect(readdirSync(join(root, 'templates', String(course.id)))).toEqual([
      `${sha256}.pdf`,
    ]);
  });

  test.each([
    ['a two-page PDF', () => createPdf(2), ApiErrorCodeEnum.PdfNotOnePage],
    [
      'a file that is not a PDF',
      () => Promise.resolve(new TextEncoder().encode('hello')),
      ApiErrorCodeEnum.InvalidPdf,
    ],
  ])(
    'GIVEN %s WHEN uploading THEN answers 400 and leaves no file',
    async (_, file, error) => {
      const { root, template } = await setup();

      const response = await template('POST', '/base-pdf', await file());

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error });
      expect(readdirSync(join(root, 'templates'))).toEqual([]);
    },
  );

  test('GIVEN a file over the size limit WHEN uploading THEN answers 413 and leaves no file', async () => {
    const { root, template } = await setup();

    const response = await template(
      'POST',
      '/base-pdf',
      new Uint8Array(6 * 1024 * 1024),
    );

    expect(response.status).toBe(413);
    expect(readdirSync(join(root, 'templates'))).toEqual([]);
  });

  test('GIVEN an uploaded PDF WHEN downloading it by hash THEN answers it with immutable caching', async () => {
    const { template, uploadPdf } = await setup();
    const { basePdf } = await uploadPdf();

    const response = await template('GET', `/base-pdf/${basePdf}`);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/pdf');
    expect(response.headers.get('Cache-Control')).toContain('immutable');
  });

  test('GIVEN a PDF uploaded to another course WHEN downloading it THEN answers 404', async () => {
    const { database, template, uploadPdf } = await setup();
    const { basePdf } = await uploadPdf();
    const other = new MockSeeder(database.getRepositories()).course();

    const response = await template(
      'GET',
      `/base-pdf/${basePdf}`,
      undefined,
      other.id,
    );

    expect(response.status).toBe(404);
  });
});

describe('TemplateRoutes (save)', () => {
  test('GIVEN a course without a template WHEN getting it THEN answers null', async () => {
    const { template } = await setup();

    const response = await template('GET');

    expect(response.status).toBe(200);
    expect(await response.json()).toBeNull();
  });

  test('GIVEN a base PDF and a font WHEN saving twice THEN creates versions 1 and 2, with their fonts, and audits both', async () => {
    const { course, database, template, uploadFont, uploadPdf } = await setup();
    const font = await uploadFont();
    const { basePdf } = await uploadPdf();
    const body = request(basePdf, font.sha256);

    const first = await template('POST', '', body);
    const second = await template('POST', '', body);
    const latest = (await (await template('GET')).json()) as TemplateDetail;

    expect([first.status, second.status]).toEqual([201, 201]);
    expect(latest).toEqual({
      id: expect.any(Number),
      courseId: course.id,
      version: 2,
      template: body.template,
      basePdf,
      fonts: [font],
      createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    });
    expect(
      database
        .getRepositories()
        .auditLog.list({ page: 1, size: 50 })
        .items.filter(
          (entry) => entry.entity === AuditEntityEnum.TemplateVersion,
        )
        .map((entry) => [entry.action, entry.details]),
    ).toEqual([
      [AuditActionEnum.Create, { courseId: course.id, version: 2 }],
      [AuditActionEnum.Create, { courseId: course.id, version: 1 }],
    ]);
  });

  test('GIVEN a field with a font that is not stored WHEN saving THEN answers unknown_font', async () => {
    const { template, uploadPdf } = await setup();
    const { basePdf } = await uploadPdf();

    const response = await template(
      'POST',
      '',
      request(basePdf, 'f'.repeat(64)),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: ApiErrorCodeEnum.UnknownFont,
    });
  });

  test.each([
    { case: 'an unknown field', type: 'fieldText:999', fieldType: 'text' },
    {
      case: 'an image field as text',
      type: 'fieldText:ID',
      fieldType: 'image',
    },
    {
      case: 'a text field as an image',
      type: 'fieldImage:ID',
      fieldType: 'text',
    },
  ] as const)(
    'GIVEN $case WHEN saving THEN answers unknown_field',
    async ({ type, fieldType }) => {
      const { course, database, template, uploadFont, uploadPdf } =
        await setup();
      const font = await uploadFont();
      const { basePdf } = await uploadPdf();
      const field = new MockSeeder(database.getRepositories()).field(course, {
        type: fieldType,
      });
      const body = request(basePdf, font.sha256);
      body.template.schemas[0]!.push({
        name: 'Field',
        type: type.replace('ID', String(field.id)) as 'fieldText:1',
        position: { x: 20, y: 120 },
        width: 50,
        height: 10,
        fontName: font.sha256,
      });

      const response = await template('POST', '', body);

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        error: ApiErrorCodeEnum.UnknownField,
      });
    },
  );

  test('GIVEN a field of the course WHEN saving THEN saves it', async () => {
    const { course, database, template, uploadFont, uploadPdf } = await setup();
    const font = await uploadFont();
    const { basePdf } = await uploadPdf();
    const field = new MockSeeder(database.getRepositories()).field(course);
    const body = request(basePdf, font.sha256);
    body.template.schemas[0]!.push({
      name: 'Group',
      type: `fieldText:${field.id}`,
      position: { x: 20, y: 120 },
      width: 50,
      height: 10,
      fontName: font.sha256,
    });

    const response = await template('POST', '', body);

    expect(response.status).toBe(201);
  });

  test('GIVEN a base PDF that was never uploaded WHEN saving THEN answers unknown_base_pdf', async () => {
    const { template, uploadFont } = await setup();
    const font = await uploadFont();

    const response = await template(
      'POST',
      '',
      request('e'.repeat(64), font.sha256),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: ApiErrorCodeEnum.UnknownBasePdf,
    });
  });

  test.each([
    ['a text field without a font', { fontName: undefined }],
    ['an unknown field type', { type: 'text' }],
    ['a repeated field name', { name: 'QR' }],
  ])('GIVEN %s WHEN saving THEN answers invalid_request', async (_, change) => {
    const { template, uploadFont, uploadPdf } = await setup();
    const font = await uploadFont();
    const { basePdf } = await uploadPdf();
    const body = request(basePdf, font.sha256);
    const [name, qr] = body.template.schemas[0]!;

    const response = await template('POST', '', {
      ...body,
      template: { schemas: [[{ ...name, ...change }, qr]] },
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: ApiErrorCodeEnum.InvalidRequest,
    });
  });

  test('GIVEN a missing course WHEN saving THEN answers 404', async () => {
    const { template } = await setup();

    const response = await template(
      'POST',
      '',
      request('e'.repeat(64), 'f'.repeat(64)),
      999,
    );

    expect(response.status).toBe(404);
  });
});
