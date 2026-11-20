import { FontsourceFontCatalog } from '../../../src/catalog/catalogs/FontsourceFontCatalog';
import { type FontCatalogHarness, SampleFileBytes } from './FontCatalogHarness';
import { MockFetch } from './MockFetch';

export const FontsourceListUrl = 'https://api.fontsource.org/v1/fonts';

export const FontsourceFileUrl =
  'https://cdn.jsdelivr.net/fontsource/fonts/roboto@5.3.0/';

function file(subset: string, weight: number, style: string) {
  return {
    url: {
      woff2: `${FontsourceFileUrl}${subset}-${weight}-${style}.woff2`,
      ttf: `${FontsourceFileUrl}${subset}-${weight}-${style}.ttf`,
    },
  };
}

// shaped like the answers of api.fontsource.org, trimmed to a few families
const List = [
  {
    id: 'roboto',
    family: 'Roboto',
    subsets: ['latin', 'latin-ext', 'vietnamese'],
    weights: [400, 700],
    styles: ['italic', 'normal'],
    defSubset: 'latin',
    variable: true,
    lastModified: '2026-02-19',
    category: 'sans-serif',
    license: 'OFL-1.1',
    type: 'google',
  },
  {
    id: 'roboto-slab',
    family: 'Roboto Slab',
    subsets: ['latin'],
    weights: [400],
    styles: ['normal'],
    defSubset: 'latin',
    category: 'serif',
    license: 'OFL-1.1',
  },
  {
    id: 'lobster',
    family: 'Lobster',
    subsets: ['latin'],
    weights: [400],
    styles: ['normal'],
    defSubset: 'latin',
    category: 'display',
    license: 'OFL-1.1',
  },
  { id: 5, family: null },
];

const Roboto = {
  id: 'roboto',
  family: 'Roboto',
  subsets: ['latin', 'latin-ext', 'vietnamese'],
  defSubset: 'latin',
  variants: {
    '400': {
      normal: {
        latin: file('latin', 400, 'normal'),
        'latin-ext': file('latin-ext', 400, 'normal'),
        vietnamese: file('vietnamese', 400, 'normal'),
      },
      italic: { latin: file('latin', 400, 'italic') },
    },
    '700': { normal: { latin: file('latin', 700, 'normal') } },
  },
};

export const fontsourceHarness: FontCatalogHarness = {
  create: (options = {}) => {
    const fetch = new MockFetch()
      .on(FontsourceFileUrl, () => new Response(SampleFileBytes))
      .on(FontsourceListUrl, (url) =>
        url === FontsourceListUrl
          ? Response.json(List)
          : new Response(null, { status: 404 }),
      )
      .on(`${FontsourceListUrl}/roboto`, () => Response.json(Roboto));

    return {
      catalog: new FontsourceFontCatalog({
        maxBytes: 1_000,
        ...options,
        fetch: fetch.fetch,
      }),
      fetch,
      listUrl: FontsourceListUrl,
      fileUrl: `${FontsourceFileUrl}latin-400-normal`,
      robotoId: 'roboto',
    };
  },
};
