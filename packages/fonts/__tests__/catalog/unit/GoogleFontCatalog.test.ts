import { describe, expect, test } from 'vite-plus/test';
import { fontCatalogContract } from '../contract/fontCatalogContract';
import {
  GoogleApiKey,
  GoogleFileUrl,
  googleHarness,
  GoogleListUrl,
} from '../mocks/googleHarness';

describe('GoogleFontCatalog (contract)', () => {
  fontCatalogContract(googleHarness);
});

describe('GoogleFontCatalog (search)', () => {
  test('GIVEN a search WHEN listing THEN asks for the most popular first with the API key', async () => {
    const { catalog, fetch } = googleHarness.create();

    await catalog.search({ query: 'robo' });

    const url = new URL(fetch.calls[0]!);
    expect(url.searchParams.get('key')).toBe(GoogleApiKey);
    expect(url.searchParams.get('sort')).toBe('popularity');
  });

  test('GIVEN an error WHEN searching THEN the message does not include the API key', async () => {
    const { catalog, fetch } = googleHarness.create();
    fetch.on(GoogleListUrl, () => new Response(null, { status: 500 }));

    const result = await catalog.search({ query: 'robo' });

    expect(result.isErr() && result.error.message).not.toContain(GoogleApiKey);
  });

  test('GIVEN a family WHEN searching THEN uses its name as ID and has no license', async () => {
    const { catalog } = googleHarness.create();

    const [roboto] = (await catalog.search({ query: 'roboto' })).unwrap();

    expect(roboto).toMatchObject({ id: 'Roboto', license: null });
  });
});

describe('GoogleFontCatalog (download)', () => {
  test.each([
    { variant: { weight: 400, italic: false }, file: 'regular' },
    { variant: { weight: 400, italic: true }, file: 'italic' },
    { variant: { weight: 700, italic: false }, file: '700' },
  ])(
    'GIVEN $variant WHEN downloading THEN downloads the $file file over HTTPS',
    async ({ variant, file }) => {
      const { catalog, fetch } = googleHarness.create();

      await catalog.download('Roboto', variant);

      expect(fetch.calls.at(-1)).toBe(`${GoogleFileUrl}roboto/v51/${file}.ttf`);
    },
  );

  test('GIVEN a subset WHEN downloading THEN ignores it, since each file has every script', async () => {
    const { catalog } = googleHarness.create();

    const result = await catalog.download(
      'Roboto',
      { weight: 400, italic: false },
      { subset: 'vietnamese' },
    );

    expect(result.isOk()).toBe(true);
  });
});
