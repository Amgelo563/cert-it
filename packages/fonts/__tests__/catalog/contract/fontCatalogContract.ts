import { expect, test } from 'vite-plus/test';
import { CatalogFontNotFoundError } from '../../../src/catalog/errors/CatalogFontNotFoundError';
import { FontCatalogUnavailableError } from '../../../src/catalog/errors/FontCatalogUnavailableError';
import { FontTooLargeError } from '../../../src/catalog/errors/FontTooLargeError';
import {
  type FontCatalogHarness,
  SampleFileBytes,
} from '../mocks/FontCatalogHarness';
import { NeverAnswers, streamed } from '../mocks/MockFetch';

const Regular = { weight: 400, italic: false };

/** Checks what every FontCatalog does, against sample responses. */
export function fontCatalogContract(harness: FontCatalogHarness): void {
  async function searchNames(
    options: { query: string; category?: string; limit?: number },
    catalog = harness.create().catalog,
  ): Promise<string[]> {
    return (await catalog.search(options)).unwrap().map(({ family }) => family);
  }

  test('GIVEN part of a name in any case WHEN searching THEN returns the matching families, equal matches in the catalog order', async () => {
    expect(await searchNames({ query: 'ROBO' })).toEqual([
      'Roboto',
      'Roboto Slab',
    ]);
  });

  test('GIVEN a query that starts one name and is inside another WHEN searching THEN returns the one it starts first', async () => {
    expect(await searchNames({ query: 'l' })).toEqual([
      'Lobster',
      'Roboto Slab',
    ]);
  });

  test('GIVEN a limit below the matches WHEN searching THEN keeps the best ones, not the first in the catalog', async () => {
    expect(await searchNames({ query: 'l', limit: 1 })).toEqual(['Lobster']);
  });

  test('GIVEN a category WHEN searching THEN returns only families in it', async () => {
    expect(await searchNames({ query: 'robo', category: 'serif' })).toEqual([
      'Roboto Slab',
    ]);
  });

  test('GIVEN a limit WHEN searching THEN returns at most that many families', async () => {
    expect(await searchNames({ query: '', limit: 2 })).toEqual([
      'Roboto',
      'Roboto Slab',
    ]);
  });

  test('GIVEN a family WHEN searching THEN describes it with its variants and subsets, skipping malformed entries', async () => {
    const { catalog } = harness.create();

    const families = (await catalog.search({ query: '' })).unwrap();
    const roboto = families[0]!;

    expect(families).toHaveLength(3);
    expect(roboto.category).toBe('sans-serif');
    expect(roboto.subsets).toEqual(['latin', 'latin-ext', 'vietnamese']);
    expect(roboto.variants).toEqual(
      expect.arrayContaining([
        { weight: 400, italic: false },
        { weight: 400, italic: true },
        { weight: 700, italic: false },
      ]),
    );
  });

  test('GIVEN two searches within the list TTL WHEN searching THEN downloads the list once', async () => {
    const clock = { now: 0 };
    const { catalog, fetch, listUrl } = harness.create({
      now: () => clock.now,
      listTtlMs: 1_000,
    });

    await catalog.search({ query: 'a' });
    clock.now = 999;
    await catalog.search({ query: 'b' });
    clock.now = 1_000;
    await catalog.search({ query: 'c' });

    expect(fetch.count(listUrl)).toBe(2);
  });

  test('GIVEN an error status WHEN searching THEN returns FontCatalogUnavailableError with it, and tries again next time', async () => {
    const { catalog, fetch, listUrl } = harness.create();
    fetch.on(listUrl, () => new Response('down', { status: 503 }));

    const result = await catalog.search({ query: 'robo' });
    await catalog.search({ query: 'robo' });

    expect(
      result.isErr()
        && FontCatalogUnavailableError.is(result.error)
        && result.error.status,
    ).toBe(503);
    expect(fetch.count(listUrl)).toBe(2);
  });

  test('GIVEN an answer that is not the expected JSON WHEN searching THEN returns FontCatalogUnavailableError', async () => {
    const { catalog, fetch, listUrl } = harness.create();
    fetch.on(listUrl, () => new Response('<html>'));

    const result = await catalog.search({ query: 'robo' });

    expect(result.isErr() && FontCatalogUnavailableError.is(result.error)).toBe(
      true,
    );
  });

  test('GIVEN a catalog that never answers WHEN searching THEN returns FontCatalogUnavailableError after the timeout', async () => {
    const { catalog, fetch, listUrl } = harness.create({ timeoutMs: 20 });
    fetch.on(listUrl, NeverAnswers);

    const result = await catalog.search({ query: 'robo' });

    expect(result.isErr() && FontCatalogUnavailableError.is(result.error)).toBe(
      true,
    );
  });

  test('GIVEN a family and variant WHEN downloading THEN returns the file', async () => {
    const { catalog, robotoId } = harness.create();

    const result = await catalog.download(robotoId, Regular);

    expect(result.unwrap()).toEqual(SampleFileBytes);
  });

  test('GIVEN an unknown family WHEN downloading THEN returns CatalogFontNotFoundError', async () => {
    const result = await harness.create().catalog.download('missing', Regular);

    expect(result.isErr() && CatalogFontNotFoundError.is(result.error)).toBe(
      true,
    );
  });

  test('GIVEN a variant the family lacks WHEN downloading THEN returns CatalogFontNotFoundError', async () => {
    const { catalog, robotoId } = harness.create();

    const result = await catalog.download(robotoId, {
      weight: 900,
      italic: false,
    });

    expect(result.isErr() && CatalogFontNotFoundError.is(result.error)).toBe(
      true,
    );
  });

  test('GIVEN a file over maxBytes by its Content-Length WHEN downloading THEN returns FontTooLargeError', async () => {
    const { catalog, fetch, fileUrl, robotoId } = harness.create({
      maxBytes: 3,
    });
    fetch.on(fileUrl, () => new Response(SampleFileBytes));

    const result = await catalog.download(robotoId, Regular);

    expect(result.isErr() && FontTooLargeError.is(result.error)).toBe(true);
  });

  test('GIVEN a streamed file over maxBytes WHEN downloading THEN returns FontTooLargeError', async () => {
    const { catalog, fetch, fileUrl, robotoId } = harness.create({
      maxBytes: 3,
    });
    fetch.on(fileUrl, streamed(SampleFileBytes));

    const result = await catalog.download(robotoId, Regular);

    expect(result.isErr() && FontTooLargeError.is(result.error)).toBe(true);
  });

  test('GIVEN a file the catalog lost WHEN downloading THEN returns FontCatalogUnavailableError', async () => {
    const { catalog, fetch, fileUrl, robotoId } = harness.create();
    fetch.on(fileUrl, () => new Response(null, { status: 404 }));

    const result = await catalog.download(robotoId, Regular);

    expect(
      result.isErr()
        && FontCatalogUnavailableError.is(result.error)
        && result.error.status,
    ).toBe(404);
  });
}
