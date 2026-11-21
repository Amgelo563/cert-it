import {
  CatalogFontNotFoundError,
  type FontCatalog,
  FontsourceFontCatalog,
  FontTooLargeError,
  GoogleFontCatalog,
  TextOutliner,
} from '@cert-it/fonts';
import {
  type ApiErrorCode,
  ApiErrorCodeEnum,
  type CatalogFamilySummary,
  type CatalogFontPreviewQuery,
  CatalogFontPreviewQuerySchema,
  type FontCatalogSearchQuery,
  FontCatalogSearchQuerySchema,
  type FontCatalogSearchResponse,
  type FontPreview,
  FontSourceEnum,
  type FontSummary,
  type ImportCatalogFontRequest,
  ImportCatalogFontRequestSchema,
  PermissionEnum,
} from '@cert-it/shared';
import { type Context, Hono } from 'hono';
import type { ClientErrorStatusCode } from 'hono/utils/http-status';
import type { AuthEnv } from '../../auth/AuthEnv';
import type { AuthGuard } from '../../auth/AuthGuard';
import type { Config } from '../../config/schema/ConfigSchema';
import {
  type FontCatalog as FontCatalogName,
  FontCatalogEnum,
} from '../../config/schema/enums/FontCatalogEnum';
import { apiError } from '../../http/api/apiError';
import { apiValidator } from '../../http/api/apiValidator';
import { jsonBodyLimit } from '../../http/api/jsonBodyLimit';
import { FontService } from '../FontService';

/** The catalog in use, or none when imports are turned off. */
export type ActiveCatalog = {
  name: FontCatalogName;
  catalog: FontCatalog;
} | null;

type FontCatalogServiceOptions = {
  guard: AuthGuard;
  fonts: FontService;
  active: ActiveCatalog;
};

/** Serves the font catalog routes, for Editors: search the configured online catalog, and import a font from it. The server downloads it, so rendering never depends on the catalog. */
export class FontCatalogService {
  /** Path of the routes, relative to the base path. */
  public static readonly Path = '/api/font-catalog';

  protected static readonly ErrorStatuses: Partial<
    Record<ApiErrorCode, ClientErrorStatusCode>
  > = {
    [ApiErrorCodeEnum.NotFound]: 404,
    [ApiErrorCodeEnum.FileTooLarge]: 413,
  };

  // previews kept, so switching styles back and forth downloads each once
  protected static readonly MaxCachedPreviews = 50;

  protected readonly guard: AuthGuard;

  protected readonly fonts: FontService;

  protected readonly active: ActiveCatalog;

  // oldest first, as a Map keeps insertion order
  protected readonly previews = new Map<string, FontPreview>();

  protected readonly app: ReturnType<FontCatalogService['createApp']>;

  constructor(options: FontCatalogServiceOptions) {
    this.guard = options.guard;
    this.fonts = options.fonts;
    this.active = options.active;
    this.app = this.createApp();
  }

  public static create(options: {
    config: Config;
    guard: AuthGuard;
    fonts: FontService;
    injections?: Partial<FontCatalogServiceOptions>;
  }): FontCatalogService {
    const { config, injections } = options;

    return new FontCatalogService({
      guard: injections?.guard ?? options.guard,
      fonts: injections?.fonts ?? options.fonts,
      active:
        injections?.active === undefined
          ? FontCatalogService.createCatalog(config)
          : injections.active,
    });
  }

  /** Returns the routes, to mount at {@link FontCatalogService.Path}. */
  public getApp(): FontCatalogService['app'] {
    return this.app;
  }

  protected static createCatalog(config: Config): ActiveCatalog {
    const { catalog, googleApiKey } = config.fonts;
    const maxBytes = config.uploads.maxFontMb * 1024 * 1024;

    switch (catalog) {
      case FontCatalogEnum.Fontsource:
        return {
          name: catalog,
          catalog: new FontsourceFontCatalog({ maxBytes }),
        };
      case FontCatalogEnum.Google:
        // the config schema requires the key with this catalog
        return {
          name: catalog,
          catalog: new GoogleFontCatalog({ maxBytes, apiKey: googleApiKey! }),
        };
      case FontCatalogEnum.None:
        return null;
    }
  }

  // chained, so hono/client can infer the routes' types
  protected createApp() {
    const { guard } = this;

    return new Hono<AuthEnv>({ strict: false })
      .use(guard.authenticate())
      .get(
        '/',
        guard.requirePermission(PermissionEnum.EditCourses),
        apiValidator('query', FontCatalogSearchQuerySchema),
        (c) => this.search(c, c.req.valid('query')),
      )
      .get(
        '/preview',
        guard.requirePermission(PermissionEnum.EditCourses),
        apiValidator('query', CatalogFontPreviewQuerySchema),
        (c) => this.preview(c, c.req.valid('query')),
      )
      .post(
        '/import',
        guard.requirePermission(PermissionEnum.EditCourses),
        jsonBodyLimit(),
        apiValidator('json', ImportCatalogFontRequestSchema),
        (c) => this.import(c, c.req.valid('json')),
      );
  }

  // with imports turned off it answers no catalog, so the panel can hide the search
  protected async search(c: Context<AuthEnv>, query: FontCatalogSearchQuery) {
    if (!this.active) {
      return c.json<FontCatalogSearchResponse, 200>(
        { catalog: null, families: [] },
        200,
      );
    }

    const found = await this.active.catalog.search({
      query: query.search ?? '',
    });
    if (found.isErr()) return this.unavailable(c);

    return c.json<FontCatalogSearchResponse, 200>(
      {
        catalog: this.active.name,
        families: found.value.map((family): CatalogFamilySummary => ({
          id: family.id,
          family: family.family,
          category: family.category,
          variants: family.variants,
          subsets: family.subsets,
        })),
      },
      200,
    );
  }

  // downloads the style without storing it, and answers the text drawn in it
  protected async preview(c: Context<AuthEnv>, query: CatalogFontPreviewQuery) {
    if (!this.active) return this.error(c, ApiErrorCodeEnum.NotFound);

    const key = JSON.stringify(query);
    let preview = this.previews.get(key);
    if (!preview) {
      const downloaded = await this.active.catalog.download(
        query.id,
        { weight: query.weight, italic: query.italic === 'true' },
        { subset: query.subset },
      );
      if (downloaded.isErr()) return this.downloadError(c, downloaded.error);

      const outliner = TextOutliner.fromBytes(downloaded.value);
      if (outliner.isErr()) return this.unavailable(c);
      preview = outliner.value.outline(query.text);
      this.remember(key, preview);
    }

    c.header('Cache-Control', FontService.PreviewCacheControl);
    return c.json<FontPreview, 200>(preview, 200);
  }

  protected remember(key: string, preview: FontPreview): void {
    this.previews.set(key, preview);
    if (this.previews.size > FontCatalogService.MaxCachedPreviews) {
      const oldest = this.previews.keys().next().value;
      if (oldest !== undefined) this.previews.delete(oldest);
    }
  }

  protected downloadError(c: Context<AuthEnv>, error: unknown) {
    if (CatalogFontNotFoundError.is(error)) {
      return this.error(c, ApiErrorCodeEnum.NotFound);
    }
    if (FontTooLargeError.is(error)) {
      return this.error(c, ApiErrorCodeEnum.FileTooLarge);
    }
    return this.unavailable(c);
  }

  protected async import(c: Context<AuthEnv>, body: ImportCatalogFontRequest) {
    if (!this.active) return this.error(c, ApiErrorCodeEnum.NotFound);

    const downloaded = await this.active.catalog.download(
      body.id,
      { weight: body.weight, italic: body.italic },
      { subset: body.subset },
    );
    if (downloaded.isErr()) return this.downloadError(c, downloaded.error);

    const stored = await this.fonts.storeFont(
      downloaded.value,
      FontSourceEnum.Catalog,
      c.get('user').id,
    );
    // the catalog's file should always be a font, so this is the catalog's fault
    if (stored.isErr()) return this.unavailable(c);

    const { font, created } = stored.value;
    return created
      ? c.json<FontSummary, 201>(FontService.toSummary(font), 201)
      : c.json<FontSummary, 200>(FontService.toSummary(font), 200);
  }

  protected unavailable(c: Context<AuthEnv>) {
    return apiError(c, 503, ApiErrorCodeEnum.CatalogUnavailable);
  }

  protected error(c: Context<AuthEnv>, code: ApiErrorCode) {
    return apiError(c, FontCatalogService.ErrorStatuses[code] ?? 400, code);
  }
}
