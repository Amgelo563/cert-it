import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SiteUrl } from '@cert-it/hono';
import { afterEach, beforeEach, describe, expect, test } from 'vite-plus/test';
import type { DatabaseService } from '../../../src/database/DatabaseService';
import { StartupError } from '../../../src/error/StartupError';
import { PublicAssetsService } from '../../../src/page/PublicAssetsService';
import { createTestDatabase } from '../../database/mocks/createTestDatabase';
import { createApiHarness } from '../../http/mocks/createApiHarness';
import {
  PublicBuildDirectory,
  PublicBuildFiles,
} from '../mocks/createPublicPageOptions';

const Immutable = 'public, max-age=31536000, immutable';

let database: DatabaseService;
let harness: ReturnType<typeof createApiHarness>;

beforeEach(() => {
  database = createTestDatabase();
  harness = createApiHarness(database);
});

afterEach(() => {
  database.close();
});

describe('PublicAssetsService (GET /static/*)', () => {
  test('GIVEN a built script WHEN requesting it THEN serves it as immutable', async () => {
    const response = await harness.requestPublic(
      `/static/${PublicBuildFiles.script}`,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe(Immutable);
    expect(await response.text()).toBe(
      readFileSync(join(PublicBuildDirectory, PublicBuildFiles.script), 'utf8'),
    );
  });

  test('GIVEN a pdf.js fallback decoder WHEN requesting it THEN serves it as immutable', async () => {
    const response = await harness.requestPublic(
      `/static/${PublicBuildFiles.pdfjsFallback}`,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe(Immutable);
  });

  test.each([
    '/static/.vite/manifest.json',
    '/static/assets/missing-000000.js',
    '/static/assets/..%2f.vite/manifest.json',
    '/static/',
  ])(
    'GIVEN %s WHEN requesting it THEN answers 404 without caching',
    async (path) => {
      const response = await harness.requestPublic(path);

      expect(response.status).toBe(404);
      expect(response.headers.get('cache-control')).toBe('no-store');
    },
  );
});

describe('PublicAssetsService (start)', () => {
  const siteUrl = new SiteUrl({ baseUrl: 'https://example.org/certs' });

  test('GIVEN a build WHEN getting a page THEN returns its script and styles under the base path', () => {
    const assets = new PublicAssetsService({
      directory: PublicBuildDirectory,
      siteUrl,
    });
    assets.start();

    expect(assets.getPage('certificate')).toEqual({
      script: `/certs/static/${PublicBuildFiles.script}`,
      styles: [`/certs/static/${PublicBuildFiles.style}`],
    });
  });

  test('GIVEN a missing build WHEN starting THEN throws a StartupError', () => {
    const assets = new PublicAssetsService({
      directory: 'missing-public-build',
      siteUrl,
    });

    expect(() => assets.start()).toThrow(StartupError);
  });

  test('GIVEN a build without the entry WHEN getting it THEN throws', () => {
    const assets = new PublicAssetsService({
      directory: PublicBuildDirectory,
      siteUrl,
    });
    assets.start();

    expect(() => assets.getPage('missing')).toThrow('no "missing" entry');
  });
});
