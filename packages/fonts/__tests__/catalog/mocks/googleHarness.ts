import { GoogleFontCatalog } from '../../../src/catalog/catalogs/GoogleFontCatalog';
import { type FontCatalogHarness, SampleFileBytes } from './FontCatalogHarness';
import { MockFetch } from './MockFetch';

export const GoogleApiKey = 'test-api-key';

export const GoogleListUrl = 'https://www.googleapis.com/webfonts/v1/webfonts';

export const GoogleFileUrl = 'https://fonts.gstatic.com/s/';

// shaped like the answer of the Google Fonts Developer API, trimmed to a few families
const List = {
  kind: 'webfonts#webfontList',
  items: [
    {
      kind: 'webfonts#webfont',
      family: 'Roboto',
      variants: ['regular', 'italic', '700'],
      subsets: ['latin', 'latin-ext', 'vietnamese'],
      version: 'v51',
      lastModified: '2026-02-19',
      files: {
        regular: 'http://fonts.gstatic.com/s/roboto/v51/regular.ttf',
        italic: 'http://fonts.gstatic.com/s/roboto/v51/italic.ttf',
        '700': 'http://fonts.gstatic.com/s/roboto/v51/700.ttf',
      },
      category: 'sans-serif',
    },
    {
      family: 'Roboto Slab',
      variants: ['regular'],
      subsets: ['latin'],
      files: {
        regular: 'http://fonts.gstatic.com/s/robotoslab/v1/regular.ttf',
      },
      category: 'serif',
    },
    {
      family: 'Lobster',
      variants: ['regular'],
      subsets: ['latin'],
      files: { regular: 'http://fonts.gstatic.com/s/lobster/v1/regular.ttf' },
      category: 'display',
    },
    { family: 7 },
  ],
};

export const googleHarness: FontCatalogHarness = {
  create: (options = {}) => {
    const fetch = new MockFetch()
      .on(GoogleFileUrl, () => new Response(SampleFileBytes))
      .on(GoogleListUrl, () => Response.json(List));

    return {
      catalog: new GoogleFontCatalog({
        maxBytes: 1_000,
        ...options,
        apiKey: GoogleApiKey,
        fetch: fetch.fetch,
      }),
      fetch,
      listUrl: GoogleListUrl,
      fileUrl: `${GoogleFileUrl}roboto/v51/regular`,
      robotoId: 'Roboto',
    };
  },
};
