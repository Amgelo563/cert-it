import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  type CatalogFamily,
  CatalogFontNotFoundError,
  type FontCatalog,
  FontCatalogUnavailableError,
} from '@cert-it/fonts';
import {
  ApiErrorCodeEnum,
  type FontCatalogSearchResponse,
  type FontPreview,
  type FontSummary,
  RoleEnum,
} from '@cert-it/shared';
import { Result } from 'better-result';
import { afterEach, describe, expect, test } from 'vite-plus/test';
import type { DatabaseService } from '../../../src/database/DatabaseService';
import type { ActiveCatalog } from '../../../src/font/catalog/FontCatalogRoutes';
import { DataDirectoryService } from '../../../src/storage/DataDirectoryService';
import { createTestDatabase } from '../../database/mocks/createTestDatabase';
import { createApiHarness } from '../../http/mocks/createApiHarness';
import { readFontFixture } from '../mocks/readFontFixture';

const Inter: CatalogFamily = {
  id: 'inter',
  family: 'Inter',
  category: 'sans-serif',
  variants: [{ weight: 400, italic: false }],
  subsets: ['latin', 'latin-ext'],
  license: 'OFL-1.1',
};

// a catalog with one family, whose regular weight is the Inter fixture
class FakeCatalog implements FontCatalog {
  public available = true;

  public downloads: { id: string; subset?: string }[] = [];

  public search(options: { query: string }) {
    if (!this.available) return Promise.resolve(Result.err(this.down()));
    const query = options.query.toLowerCase();
    return Promise.resolve(
      Result.ok([Inter].filter((f) => f.family.toLowerCase().includes(query))),
    );
  }

  public download(
    id: string,
    variant: { weight: number; italic: boolean },
    options: { subset?: string } = {},
  ) {
    this.downloads.push({ id, subset: options.subset });
    if (!this.available) return Promise.resolve(Result.err(this.down()));
    if (id !== Inter.id || variant.weight !== 400 || variant.italic) {
      return Promise.resolve(
        Result.err(
          new CatalogFontNotFoundError({ catalog: 'Fake', id, variant }),
        ),
      );
    }
    return Promise.resolve(Result.ok(readFontFixture('basic.ttf')));
  }

  protected down(): FontCatalogUnavailableError {
    return new FontCatalogUnavailableError({ catalog: 'Fake', reason: 'down' });
  }
}

const databases: DatabaseService[] = [];
const roots: string[] = [];

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

async function setup(catalog: FakeCatalog | null = new FakeCatalog()) {
  const database = createTestDatabase();
  databases.push(database);
  const root = mkdtempSync(join(tmpdir(), 'cert-it-catalog-'));
  roots.push(root);
  const dataDirectory = DataDirectoryService.create({ root });
  dataDirectory.start();
  const active: ActiveCatalog = catalog
    ? { name: 'fontsource', catalog }
    : null;
  const harness = createApiHarness(database, {
    dataDirectory,
    catalog: active,
  });
  const editor = await harness.loginAs({ role: RoleEnum.Editor });
  const request = (method: string, path: string, body?: unknown) =>
    harness.request(method, `/font-catalog${path}`, {
      cookie: editor.cookie,
      body,
    });

  return { catalog, database, request };
}

describe('FontCatalogRoutes (search)', () => {
  test('GIVEN a query WHEN searching THEN answers the matching families and the catalog', async () => {
    const { request } = await setup();

    const response = await request('GET', '?search=int');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      catalog: 'fontsource',
      families: [
        {
          id: 'inter',
          family: 'Inter',
          category: 'sans-serif',
          variants: [{ weight: 400, italic: false }],
          subsets: ['latin', 'latin-ext'],
        },
      ],
    } satisfies FontCatalogSearchResponse);
  });

  test('GIVEN imports turned off WHEN searching THEN answers no catalog', async () => {
    const { request } = await setup(null);

    const response = await request('GET', '');

    expect(await response.json()).toEqual({ catalog: null, families: [] });
  });

  test('GIVEN the catalog is down WHEN searching THEN answers 503', async () => {
    const catalog = new FakeCatalog();
    catalog.available = false;
    const { request } = await setup(catalog);

    const response = await request('GET', '?search=a');

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: ApiErrorCodeEnum.CatalogUnavailable,
    });
  });
});

describe('FontCatalogRoutes (import)', () => {
  test('GIVEN a family and variant WHEN importing THEN stores the font from the catalog', async () => {
    const { catalog, database, request } = await setup();

    const response = await request('POST', '/import', {
      id: 'inter',
      weight: 400,
      italic: false,
      subset: 'latin-ext',
    });
    const font = (await response.json()) as FontSummary;

    expect(response.status).toBe(201);
    expect(font).toMatchObject({
      family: 'Inter',
      style: 'Regular',
      source: 'catalog',
    });
    expect(catalog?.downloads).toEqual([{ id: 'inter', subset: 'latin-ext' }]);
    expect(database.getRepositories().fonts.list()).toHaveLength(1);
  });

  test('GIVEN a font already stored WHEN importing it again THEN answers the stored one', async () => {
    const { database, request } = await setup();
    const body = { id: 'inter', weight: 400, italic: false };
    await request('POST', '/import', body);

    const response = await request('POST', '/import', body);

    expect(response.status).toBe(200);
    expect(database.getRepositories().fonts.list()).toHaveLength(1);
  });

  test.each([
    ['an unknown variant', new FakeCatalog(), 404],
    [
      'a catalog that is down',
      Object.assign(new FakeCatalog(), { available: false }),
      503,
    ],
    ['imports turned off', null, 404],
  ])('GIVEN %s WHEN importing THEN answers %i', async (_, catalog, status) => {
    const { request } = await setup(catalog);

    const response = await request('POST', '/import', {
      id: 'inter',
      weight: 700,
      italic: false,
    });

    expect(response.status).toBe(status);
  });
});

describe('FontCatalogRoutes (preview)', () => {
  const query = '?id=inter&weight=400&italic=false&subset=latin&text=Ada';

  test('GIVEN a family style WHEN previewing THEN draws the text without storing the font', async () => {
    const { database, request } = await setup();

    const response = await request('GET', `/preview${query}`);
    const preview = (await response.json()) as FontPreview;

    expect(response.status).toBe(200);
    expect(preview.path).toMatch(/^M/);
    expect(database.getRepositories().fonts.list()).toEqual([]);
  });

  test('GIVEN the same preview twice WHEN previewing THEN downloads the font once', async () => {
    const { catalog, request } = await setup();

    await request('GET', `/preview${query}`);
    await request('GET', `/preview${query}`);

    expect(catalog?.downloads).toHaveLength(1);
  });

  test('GIVEN an unknown style WHEN previewing THEN answers 404', async () => {
    const { request } = await setup();

    const response = await request(
      'GET',
      '/preview?id=inter&weight=700&italic=false&text=Ada',
    );

    expect(response.status).toBe(404);
  });
});

describe('FontCatalogRoutes (download)', () => {
  test('GIVEN a family style WHEN downloading THEN answers its file without storing it', async () => {
    const { database, request } = await setup();

    const response = await request(
      'GET',
      '/download?id=inter&weight=400&italic=false&subset=latin',
    );

    expect(response.status).toBe(200);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(
      new Uint8Array(readFontFixture('basic.ttf')),
    );
    expect(database.getRepositories().fonts.list()).toEqual([]);
  });

  test.each([
    ['an unknown style', new FakeCatalog(), 404],
    ['imports turned off', null, 404],
  ])(
    'GIVEN %s WHEN downloading THEN answers %i',
    async (_, catalog, status) => {
      const { request } = await setup(catalog);

      const response = await request(
        'GET',
        '/download?id=inter&weight=700&italic=false',
      );

      expect(response.status).toBe(status);
    },
  );
});
