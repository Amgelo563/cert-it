import { describe, expect, test } from 'vite-plus/test';
import { CatalogFontNotFoundError } from '../../../src/catalog/errors/CatalogFontNotFoundError';
import { fontCatalogContract } from '../contract/fontCatalogContract';
import { SampleFileBytes } from '../mocks/FontCatalogHarness';
import {
  FontsourceFileUrl,
  fontsourceHarness,
} from '../mocks/fontsourceHarness';

describe('FontsourceFontCatalog (contract)', () => {
  fontCatalogContract(fontsourceHarness);
});

describe('FontsourceFontCatalog (search)', () => {
  test('GIVEN a family with a license WHEN searching THEN includes it', async () => {
    const { catalog } = fontsourceHarness.create();

    const [roboto] = (await catalog.search({ query: 'roboto' })).unwrap();

    expect(roboto).toMatchObject({ id: 'roboto', license: 'OFL-1.1' });
  });
});

describe('FontsourceFontCatalog (download)', () => {
  test('GIVEN no subset WHEN downloading THEN downloads the default subset', async () => {
    const { catalog, fetch } = fontsourceHarness.create();

    await catalog.download('roboto', { weight: 400, italic: false });

    expect(fetch.calls.at(-1)).toBe(`${FontsourceFileUrl}latin-400-normal.ttf`);
  });

  test('GIVEN a subset WHEN downloading THEN downloads that subset as TTF', async () => {
    const { catalog, fetch } = fontsourceHarness.create();

    const result = await catalog.download(
      'roboto',
      { weight: 400, italic: false },
      { subset: 'vietnamese' },
    );

    expect(result.unwrap()).toEqual(SampleFileBytes);
    expect(fetch.calls.at(-1)).toBe(
      `${FontsourceFileUrl}vietnamese-400-normal.ttf`,
    );
  });

  test('GIVEN a subset the variant lacks WHEN downloading THEN returns CatalogFontNotFoundError naming it', async () => {
    const { catalog } = fontsourceHarness.create();

    const result = await catalog.download(
      'roboto',
      { weight: 700, italic: false },
      { subset: 'vietnamese' },
    );

    expect(
      result.isErr()
        && CatalogFontNotFoundError.is(result.error)
        && result.error.subset,
    ).toBe('vietnamese');
  });
});
