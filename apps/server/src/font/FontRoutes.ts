import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import {
  type InvalidFontError,
  InvalidFontReasonEnum,
  TextOutliner,
} from '@cert-it/fonts';
import {
  type ApiErrorCode,
  ApiErrorCodeEnum,
  DoesntExistFileError,
  type FontPreview,
  FontSourceEnum,
  type FontSummary,
  PermissionEnum,
  Sha256Schema,
} from '@cert-it/shared';
import { type Context, Hono } from 'hono';
import type { ClientErrorStatusCode } from 'hono/utils/http-status';
import type { AuthEnv } from '../auth/AuthEnv';
import type { AuthGuard } from '../auth/AuthGuard';
import type { Config } from '../config/schema/ConfigSchema';
import { AbstractApiRoutes } from '../http/api/AbstractApiRoutes';
import { UploadReader } from '../http/upload/UploadReader';
import type { Font } from './Font';
import type { FontLibrary } from './FontLibrary';

type FontRoutesOptions = {
  guard: AuthGuard;
  library: FontLibrary;
  uploads: UploadReader;
};

/** Serves the font routes: anyone can list and download fonts, Editors upload them. */
export class FontRoutes extends AbstractApiRoutes {
  /** Path of the routes, relative to the base path. */
  public static readonly Path = '/api/fonts';

  // the URL holds the hash, so the bytes never change
  public static readonly ImmutableCacheControl =
    'private, max-age=31536000, immutable';

  /** For previews: they change only with how they're drawn, so a day is plenty. */
  public static readonly PreviewCacheControl = 'private, max-age=86400';

  protected static override readonly ErrorStatuses: Partial<
    Record<ApiErrorCode, ClientErrorStatusCode>
  > = {
    [ApiErrorCodeEnum.NotFound]: 404,
    [ApiErrorCodeEnum.FileTooLarge]: 413,
  };

  protected static readonly InvalidFontCodes = {
    [InvalidFontReasonEnum.Unreadable]: ApiErrorCodeEnum.InvalidFont,
    [InvalidFontReasonEnum.Collection]: ApiErrorCodeEnum.FontCollection,
    [InvalidFontReasonEnum.WebFormat]: ApiErrorCodeEnum.WebFont,
  } as const;

  protected static readonly ContentTypes = {
    ttf: 'font/ttf',
    otf: 'font/otf',
  } as const;

  protected readonly guard: AuthGuard;

  protected readonly library: FontLibrary;

  protected readonly uploads: UploadReader;

  protected readonly app: ReturnType<FontRoutes['createApp']>;

  constructor(options: FontRoutesOptions) {
    super();
    this.guard = options.guard;
    this.library = options.library;
    this.uploads = options.uploads;
    this.app = this.createApp();
  }

  public static create(options: {
    config: Pick<Config, 'uploads'>;
    guard: AuthGuard;
    library: FontLibrary;
    injections?: Partial<Pick<FontRoutesOptions, 'uploads'>>;
  }): FontRoutes {
    const { config, guard, library, injections } = options;

    return new FontRoutes({
      guard,
      library,
      uploads:
        injections?.uploads
        ?? new UploadReader({
          maxBytes: config.uploads.maxFontMb * 1024 * 1024,
        }),
    });
  }

  /** Returns a font as the API answers it. */
  public static toSummary(this: void, font: Font): FontSummary {
    return {
      id: font.id,
      sha256: font.sha256,
      family: font.family,
      style: font.style,
      source: font.source,
      createdAt: font.createdAt.toISOString(),
    };
  }

  /** Returns the routes, to mount at {@link FontRoutes.Path}. */
  public getApp(): FontRoutes['app'] {
    return this.app;
  }

  // chained, so hono/client can infer the routes' types
  protected createApp() {
    const { guard } = this;

    return new Hono<AuthEnv>({ strict: false })
      .use(guard.authenticate())
      .get('/', guard.requirePermission(PermissionEnum.ViewRecords), (c) =>
        this.list(c),
      )
      .post('/', guard.requirePermission(PermissionEnum.EditCourses), (c) =>
        this.upload(c),
      )
      .get(
        '/:sha256',
        guard.requirePermission(PermissionEnum.ViewRecords),
        (c) => this.download(c),
      )
      .get(
        '/:sha256/preview',
        guard.requirePermission(PermissionEnum.ViewRecords),
        (c) => this.preview(c),
      );
  }

  protected list(c: Context<AuthEnv>) {
    return c.json<FontSummary[], 200>(
      this.library.list().map(FontRoutes.toSummary),
      200,
    );
  }

  // the raw file is the body; uploading a stored font again answers the stored one
  protected async upload(c: Context<AuthEnv>) {
    const bytes = await this.uploads.readBytes(c.req.raw);
    if (bytes.isErr()) return this.error(c, ApiErrorCodeEnum.FileTooLarge);

    const stored = await this.library.add(
      bytes.value,
      FontSourceEnum.Upload,
      c.get('user').id,
    );
    if (stored.isErr())
      return this.error(c, this.invalidFontCode(stored.error));

    const { font, created } = stored.value;
    return created
      ? c.json<FontSummary, 201>(FontRoutes.toSummary(font), 201)
      : c.json<FontSummary, 200>(FontRoutes.toSummary(font), 200);
  }

  // streamed without byte ranges, so the compressor still shrinks it
  protected async download(c: Context<AuthEnv>) {
    const font = this.findFont(c);
    if (!font) return this.error(c, ApiErrorCodeEnum.NotFound);

    const path = this.library.getPath(font);
    let size: number;
    try {
      size = (await stat(path)).size;
    } catch (error) {
      if (!DoesntExistFileError.matches(error)) throw error;
      return this.error(c, ApiErrorCodeEnum.NotFound);
    }

    const extension = font.fileName.endsWith('.otf') ? 'otf' : 'ttf';
    const body = Readable.toWeb(
      createReadStream(path),
    ) as ReadableStream<Uint8Array>;
    return c.body(body, 200, {
      'Content-Type': FontRoutes.ContentTypes[extension],
      'Content-Length': String(size),
      'Cache-Control': FontRoutes.ImmutableCacheControl,
    });
  }

  // the font's name drawn in itself, a few KB where the font may be MBs
  protected async preview(c: Context<AuthEnv>) {
    const font = this.findFont(c);
    if (!font) return this.error(c, ApiErrorCodeEnum.NotFound);

    let bytes: Uint8Array;
    try {
      bytes = await readFile(this.library.getPath(font));
    } catch (error) {
      if (!DoesntExistFileError.matches(error)) throw error;
      return this.error(c, ApiErrorCodeEnum.NotFound);
    }

    // stored fonts were checked when added
    const outline = TextOutliner.fromBytes(bytes)
      .unwrap()
      .outline(`${font.family} ${font.style}`);
    c.header('Cache-Control', FontRoutes.PreviewCacheControl);
    return c.json<FontPreview, 200>(outline, 200);
  }

  protected findFont(c: Context<AuthEnv>): Font | null {
    const sha256 = Sha256Schema.safeParse(c.req.param('sha256'));
    return sha256.success ? this.library.find(sha256.data) : null;
  }

  protected invalidFontCode(error: InvalidFontError): ApiErrorCode {
    return FontRoutes.InvalidFontCodes[error.reason];
  }
}
