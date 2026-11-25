import { createHash } from 'node:crypto';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  ApiErrorCodeEnum,
  type ImageUpload,
  MaxImageBytes,
  RoleEnum,
} from '@cert-it/shared';
import { afterEach, describe, expect, test } from 'vite-plus/test';
import type { DatabaseService } from '../../../src/database/DatabaseService';
import { DataDirectoryService } from '../../../src/storage/DataDirectoryService';
import { createTestDatabase } from '../../database/mocks/createTestDatabase';
import { MockSeeder } from '../../database/mocks/MockSeeder';
import { createApiHarness } from '../../http/mocks/createApiHarness';
import { TinyPng } from '../mocks/TinyPng';

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
  const root = mkdtempSync(join(tmpdir(), 'cert-it-images-'));
  roots.push(root);
  const dataDirectory = DataDirectoryService.create({ root });
  dataDirectory.start();
  const harness = createApiHarness(database, { dataDirectory });
  const editor = await harness.loginAs({ role: RoleEnum.Editor });
  const course = new MockSeeder(database.getRepositories()).course();
  const images = (method: string, path = '', body?: unknown) =>
    harness.request(method, `/courses/${course.id}/images${path}`, {
      cookie: editor.cookie,
      body,
    });

  return { course, images, root };
}

describe('FieldImageRoutes', () => {
  test('GIVEN a PNG WHEN uploading it twice THEN stores it once by its hash', async () => {
    const { course, images, root } = await setup();
    const sha256 = createHash('sha256').update(TinyPng).digest('hex');

    const first = await images('POST', '', TinyPng);
    const second = await images('POST', '', TinyPng);

    expect(first.status).toBe(201);
    expect((await first.json()) as ImageUpload).toEqual({
      image: `${sha256}.png`,
    });
    expect(await second.json()).toEqual({ image: `${sha256}.png` });
    expect(readdirSync(join(root, 'images', String(course.id)))).toEqual([
      `${sha256}.png`,
    ]);
  });

  test('GIVEN a JPEG WHEN uploading THEN names it .jpg', async () => {
    const { images } = await setup();

    const response = await images(
      'POST',
      '',
      new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]),
    );

    expect(response.status).toBe(201);
    expect(((await response.json()) as ImageUpload).image).toMatch(/\.jpg$/);
  });

  test('GIVEN a file that is not an image WHEN uploading THEN answers 400', async () => {
    const { images } = await setup();

    const response = await images('POST', '', 'just text');

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: ApiErrorCodeEnum.InvalidImage,
    });
  });

  test('GIVEN an image over the limit WHEN uploading THEN answers 413', async () => {
    const { images } = await setup();
    const large = new Uint8Array(MaxImageBytes + 1);
    large.set(TinyPng);

    const response = await images('POST', '', large);

    expect(response.status).toBe(413);
  });

  test('GIVEN a stored image WHEN downloading it THEN answers its bytes as an image', async () => {
    const { images } = await setup();
    const { image } = (await (
      await images('POST', '', TinyPng)
    ).json()) as ImageUpload;

    const response = await images('GET', `/${image}`);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/png');
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(TinyPng);
  });

  test.each(['missing.png', `${'a'.repeat(64)}.png`])(
    'GIVEN the name %s WHEN downloading THEN answers 404',
    async (name) => {
      const { images } = await setup();

      const response = await images('GET', `/${name}`);

      expect(response.status).toBe(404);
    },
  );
});
