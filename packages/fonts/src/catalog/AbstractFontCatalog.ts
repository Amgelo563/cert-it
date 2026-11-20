import { Result } from 'better-result';
import type { CatalogFamily } from './CatalogFamily';
import type { CatalogVariant } from './CatalogVariant';
import type { CatalogFontNotFoundError } from './errors/CatalogFontNotFoundError';
import { FontCatalogUnavailableError } from './errors/FontCatalogUnavailableError';
import { FontTooLargeError } from './errors/FontTooLargeError';
import type { FontCatalog } from './FontCatalog';
import type { FontCatalogOptions } from './FontCatalogOptions';

/** A base for catalogs that can't search by part of a name: it downloads the whole list, keeps it for a while, and searches it in memory. */
export abstract class AbstractFontCatalog<Entry> implements FontCatalog {
  public static readonly DefaultTimeoutMs = 10_000;

  public static readonly DefaultListTtlMs = 24 * 60 * 60 * 1000;

  public static readonly DefaultSearchLimit = 20;

  /** Name used in errors, such as `Google Fonts`. */
  protected abstract readonly name: string;

  protected readonly maxBytes: number;

  protected readonly timeoutMs: number;

  protected readonly listTtlMs: number;

  protected readonly fetch: typeof fetch;

  protected readonly now: () => number;

  protected list: { entries: Entry[]; fetchedAt: number } | null = null;

  constructor(options: FontCatalogOptions) {
    this.maxBytes = options.maxBytes;
    this.timeoutMs = options.timeoutMs ?? AbstractFontCatalog.DefaultTimeoutMs;
    this.listTtlMs = options.listTtlMs ?? AbstractFontCatalog.DefaultListTtlMs;
    this.fetch = options.fetch ?? globalThis.fetch;
    this.now = options.now ?? Date.now;
  }

  public async search(options: {
    query: string;
    category?: string;
    limit?: number;
  }): Promise<Result<CatalogFamily[], FontCatalogUnavailableError>> {
    const { category, limit = AbstractFontCatalog.DefaultSearchLimit } =
      options;
    const query = options.query.trim().toLowerCase();

    const entries = await this.getEntries();
    if (entries.isErr()) return Result.err(entries.error);

    const found: CatalogFamily[] = [];
    for (const entry of entries.value) {
      if (found.length >= limit) break;

      const family = this.toFamily(entry);
      if (
        family.family.toLowerCase().includes(query)
        && (!category || family.category === category)
      ) {
        found.push(family);
      }
    }

    return Result.ok(found);
  }

  public abstract download(
    id: string,
    variant: CatalogVariant,
    options?: { subset?: string },
  ): Promise<
    Result<
      Uint8Array,
      CatalogFontNotFoundError | FontCatalogUnavailableError | FontTooLargeError
    >
  >;

  /** Returns the catalog's list, downloading it again once it's older than listTtlMs. A failed download isn't kept. */
  protected async getEntries(): Promise<
    Result<Entry[], FontCatalogUnavailableError>
  > {
    if (this.list && this.now() - this.list.fetchedAt < this.listTtlMs) {
      return Result.ok(this.list.entries);
    }

    const json = await this.fetchJson(this.getListUrl());
    if (json.isErr()) return Result.err(json.error);

    const entries = this.parseList(json.value);
    if (!entries) return Result.err(this.unavailable('unexpected list'));

    this.list = { entries, fetchedAt: this.now() };
    return Result.ok(entries);
  }

  protected abstract getListUrl(): string;

  /** Returns the list's entries, or null if the response isn't shaped as expected. Malformed entries are skipped. */
  protected abstract parseList(json: unknown): Entry[] | null;

  protected abstract toFamily(entry: Entry): CatalogFamily;

  /** Returns the parsed JSON of a response, or null for a 404. */
  protected async fetchJson(
    url: string,
  ): Promise<Result<unknown, FontCatalogUnavailableError>> {
    const response = await this.request(url);
    if (response.isErr()) return Result.err(response.error);
    if (response.value.status === 404) return Result.ok(null);

    try {
      return Result.ok(await response.value.json());
    } catch (error) {
      return Result.err(this.unavailable('unexpected response', error));
    }
  }

  /** Downloads a file, stopping as soon as it passes maxBytes. */
  protected async fetchFile(
    url: string,
  ): Promise<
    Result<Uint8Array, FontCatalogUnavailableError | FontTooLargeError>
  > {
    const response = await this.request(url);
    if (response.isErr()) return Result.err(response.error);

    // the catalog gave this URL, so a missing file means the catalog is broken
    const { body, headers, status } = response.value;
    if (status === 404) {
      await body?.cancel();
      return Result.err(this.unavailable('status 404', undefined, status));
    }

    const tooLarge = new FontTooLargeError({ maxBytes: this.maxBytes });
    if (Number(headers.get('content-length')) > this.maxBytes) {
      await body?.cancel();
      return Result.err(tooLarge);
    }
    if (!body) return Result.ok(new Uint8Array());

    const chunks: Uint8Array[] = [];
    let size = 0;
    const reader = body.getReader();

    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;

        size += value.byteLength;
        if (size > this.maxBytes) {
          await reader.cancel();
          return Result.err(tooLarge);
        }
        chunks.push(value);
      }
    } catch (error) {
      return Result.err(this.unavailable('download interrupted', error));
    }

    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }

    return Result.ok(bytes);
  }

  // a 404 is passed on, so callers can tell a missing font from a broken catalog
  protected async request(
    url: string,
  ): Promise<Result<Response, FontCatalogUnavailableError>> {
    let response: Response;
    try {
      response = await this.fetch(url, {
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      return Result.err(this.unavailable('no answer', error));
    }

    if (!response.ok && response.status !== 404) {
      await response.body?.cancel();
      return Result.err(
        this.unavailable(
          `status ${response.status}`,
          undefined,
          response.status,
        ),
      );
    }

    return Result.ok(response);
  }

  /** Returns the value as an object with the given keys, each still unknown, or null if it isn't an object. */
  protected asRecord<Key extends string>(
    value: unknown,
  ): { [K in Key]?: unknown } | null {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as { [K in Key]?: unknown })
      : null;
  }

  protected strings(value: unknown): string[] {
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string')
      : [];
  }

  // never includes the URL, which may hold an API key
  protected unavailable(
    reason: string,
    error?: unknown,
    status?: number,
  ): FontCatalogUnavailableError {
    return new FontCatalogUnavailableError({
      catalog: this.name,
      status,
      reason,
      cause: error instanceof Error ? error : undefined,
    });
  }
}
