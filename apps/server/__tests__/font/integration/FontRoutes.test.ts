import { createHash } from 'node:crypto';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  ApiErrorCodeEnum,
  AuditActionEnum,
  AuditEntityEnum,
  type FontPreview,
  type FontSummary,
  RoleEnum,
} from '@cert-it/shared';
import { afterEach, describe, expect, test } from 'vite-plus/test';
import type { DatabaseService } from '../../../src/database/DatabaseService';
import { DataDirectoryService } from '../../../src/storage/DataDirectoryService';
import { createTestDatabase } from '../../database/mocks/createTestDatabase';
import { createApiHarness } from '../../http/mocks/createApiHarness';
import { readFontFixture } from '../mocks/readFontFixture';

const databases: DatabaseService[] = [];
const roots: string[] = [];

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

// an Editor logged in through the API, with a started data directory
async function setup() {
  const database = createTestDatabase();
  databases.push(database);
  const root = mkdtempSync(join(tmpdir(), 'cert-it-fonts-'));
  roots.push(root);
  const dataDirectory = DataDirectoryService.create({ root });
  dataDirectory.start();
  const harness = createApiHarness(database, { dataDirectory });
  const editor = await harness.loginAs({ role: RoleEnum.Editor });
  const fonts = (method: string, path = '', body?: unknown) =>
    harness.request(method, `/fonts${path}`, { cookie: editor.cookie, body });
  const auditEntries = () =>
    database
      .getRepositories()
      .auditLog.list({ page: 1, size: 50 })
      .items.filter((entry) => entry.entity === AuditEntityEnum.Font);

  return { auditEntries, database, editor, fonts, root };
}

const sha256 = (bytes: Uint8Array) =>
  createHash('sha256').update(bytes).digest('hex');

describe('FontRoutes (upload)', () => {
  test('GIVEN a TTF WHEN uploading THEN stores it by hash, answers its details and audits it', async () => {
    const { auditEntries, fonts, root } = await setup();
    const bytes = readFontFixture('basic.ttf');

    const response = await fonts('POST', '', bytes);
    const font = (await response.json()) as FontSummary;

    expect(response.status).toBe(201);
    expect(font).toEqual({
      id: expect.any(Number),
      sha256: sha256(bytes),
      family: 'Inter',
      style: 'Regular',
      source: 'upload',
      createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    });
    expect(readdirSync(join(root, 'fonts'))).toEqual([`${sha256(bytes)}.ttf`]);
    expect(auditEntries()).toMatchObject([
      {
        action: AuditActionEnum.Create,
        entityId: font.id,
        details: { family: 'Inter', style: 'Regular' },
      },
    ]);
  });

  test('GIVEN a font already stored WHEN uploading it again THEN answers the stored one without a new entry', async () => {
    const { auditEntries, database, fonts } = await setup();
    const bytes = readFontFixture('basic.ttf');
    const first = (await (
      await fonts('POST', '', bytes)
    ).json()) as FontSummary;

    const response = await fonts('POST', '', bytes);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(first);
    expect(database.getRepositories().fonts.list()).toHaveLength(1);
    expect(auditEntries()).toHaveLength(1);
  });

  test.each([
    [
      'a WOFF2 web font',
      readFontFixture('basic.woff2'),
      ApiErrorCodeEnum.WebFont,
    ],
    [
      'a file that is not a font',
      new TextEncoder().encode('hello'),
      ApiErrorCodeEnum.InvalidFont,
    ],
  ])(
    'GIVEN %s WHEN uploading THEN answers 400 and stores nothing',
    async (_, bytes, error) => {
      const { database, fonts, root } = await setup();

      const response = await fonts('POST', '', bytes);

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error });
      expect(database.getRepositories().fonts.list()).toEqual([]);
      expect(readdirSync(join(root, 'fonts'))).toEqual([]);
    },
  );

  test('GIVEN a file over the size limit WHEN uploading THEN answers 413', async () => {
    const { fonts } = await setup();

    const response = await fonts('POST', '', new Uint8Array(9 * 1024 * 1024));

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({
      error: ApiErrorCodeEnum.FileTooLarge,
    });
  });
});

describe('FontRoutes (list and download)', () => {
  test('GIVEN stored fonts WHEN listing THEN answers them by family', async () => {
    const { fonts } = await setup();
    await fonts('POST', '', readFontFixture('basic.ttf'));
    await fonts('POST', '', readFontFixture('basic.otf'));

    const response = await fonts('GET');
    const list = (await response.json()) as FontSummary[];

    expect(list.map((font) => font.family)).toEqual(['Inconsolata', 'Inter']);
  });

  test('GIVEN a stored font WHEN downloading it by hash THEN answers its bytes with immutable caching', async () => {
    const { fonts } = await setup();
    const bytes = readFontFixture('basic.otf');
    await fonts('POST', '', bytes);

    const response = await fonts('GET', `/${sha256(bytes)}`);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('font/otf');
    expect(response.headers.get('Cache-Control')).toBe(
      'private, max-age=31536000, immutable',
    );
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
  });

  test.each([
    ['an unknown hash', 'a'.repeat(64)],
    ['a malformed hash', 'abc'],
  ])(
    'GIVEN %s WHEN downloading THEN answers 404 without caching',
    async (_, hash) => {
      const { fonts } = await setup();

      const response = await fonts('GET', `/${hash}`);

      expect(response.status).toBe(404);
      expect(response.headers.get('Cache-Control')).toBe('no-store');
    },
  );
});

describe('FontRoutes (preview)', () => {
  test('GIVEN a stored font WHEN previewing it THEN answers its name drawn as SVG path data', async () => {
    const { fonts } = await setup();
    const bytes = readFontFixture('basic.ttf');
    await fonts('POST', '', bytes);

    const response = await fonts('GET', `/${sha256(bytes)}/preview`);
    const preview = (await response.json()) as FontPreview;

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe(
      'private, max-age=86400',
    );
    expect(preview.path).toMatch(/^M-?\d+ -?\d+/);
    expect(preview.viewBox).toMatch(/^0 -\d+ \d+ \d+$/);
  });

  test('GIVEN an unknown hash WHEN previewing THEN answers 404', async () => {
    const { fonts } = await setup();

    const response = await fonts('GET', `/${'a'.repeat(64)}/preview`);

    expect(response.status).toBe(404);
  });
});
