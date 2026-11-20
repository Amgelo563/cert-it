import type { FontCatalog } from '../../../src/catalog/FontCatalog';
import type { FontCatalogOptions } from '../../../src/catalog/FontCatalogOptions';
import type { MockFetch } from './MockFetch';

/** Bytes every sample font file has. */
export const SampleFileBytes = new Uint8Array([0x46, 0x4f, 0x4e, 0x54]);

/** A catalog over a MockFetch that answers sample responses for Roboto (400, 400 italic, 700), Roboto Slab (serif) and Lobster (display), in that order. */
export type FontCatalogHarness = {
  create(options?: Partial<FontCatalogOptions>): {
    catalog: FontCatalog;
    fetch: MockFetch;
    /** Prefix of the list request. */
    listUrl: string;
    /** Prefix of Roboto 400's file. */
    fileUrl: string;
    /** Catalog ID of Roboto. */
    robotoId: string;
  };
};
