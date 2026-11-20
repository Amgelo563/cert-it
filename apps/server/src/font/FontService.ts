import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { InvalidFontError, InvalidFontReasonEnum } from '@cert-it/fonts';
import { FontStore } from '@cert-it/fonts/node';
import {
  type ApiErrorCode,
  ApiErrorCodeEnum,
  AuditActionEnum,
  AuditEntityEnum,
  DoesntExistFileError,
  FontSourceEnum,
  type FontSummary,
  PermissionEnum,
  Sha256Schema,
} from '@cert-it/shared';
import { type Context, Hono } from 'hono';
import type { ClientErrorStatusCode } from 'hono/utils/http-status';
import type { AuditLogService } from '../audit/AuditLogService';
import type { AuthEnv } from '../auth/AuthEnv';
import type { AuthGuard } from '../auth/AuthGuard';
import type { Config } from '../config/schema/ConfigSchema';
import type { DatabaseService } from '../database/DatabaseService';
import { apiError } from '../http/api/apiError';
import { UploadReader } from '../http/upload/UploadReader';
import type { DataDirectoryService } from '../storage/DataDirectoryService';
import type { Font } from './Font';

type FontServiceOptions = {
  database: DatabaseService;
  guard: AuthGuard;
  auditLog: AuditLogService;
  store: FontStore;
  uploads: UploadReader;
};

/** Serves the font routes: anyone can list and download fonts, Editors upload them. */
export class FontService {
  /** Path of the routes, relative to the base path. */
  public static readonly Path = '/api/fonts';

  // the URL holds the hash, so the bytes never change
  public static readonly ImmutableCacheControl =
    'private, max-age=31536000, immutable';

  protected static readonly ErrorStatuses: Partial<
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

  protected readonly database: DatabaseService;

  protected readonly guard: AuthGuard;

  protected readonly auditLog: AuditLogService;

  protected readonly store: FontStore;

  protected readonly uploads: UploadReader;

  protected readonly app: ReturnType<FontService['createApp']>;

  constructor(options: FontServiceOptions) {
    this.database = options.database;
    this.guard = options.guard;
    this.auditLog = options.auditLog;
    this.store = options.store;
    this.uploads = options.uploads;
    this.app = this.createApp();
  }

  public static create(options: {
    config: Config;
    database: DatabaseService;
    dataDirectory: DataDirectoryService;
    guard: AuthGuard;
    auditLog: AuditLogService;
    injections?: Partial<FontServiceOptions>;
  }): FontService {
    const { config, dataDirectory, injections } = options;

    return new FontService({
      database: injections?.database ?? options.database,
      guard: injections?.guard ?? options.guard,
      auditLog: injections?.auditLog ?? options.auditLog,
      store:
        injections?.store
        ?? new FontStore({ directory: dataDirectory.getFontsFolder() }),
      uploads:
        injections?.uploads
        ?? new UploadReader({
          maxBytes: config.uploads.maxFontMb * 1024 * 1024,
        }),
    });
  }

  /** Returns the routes, to mount at {@link FontService.Path}. */
  public getApp(): FontService['app'] {
    return this.app;
  }

  /**
   * Returns the path of a stored font file.
   *
   * @throws {Error} If the name isn't the name of a stored font.
   */
  public getFontPath(font: Font): string {
    return this.store.getPath(font.fileName);
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
      );
  }

  protected list(c: Context<AuthEnv>) {
    const fonts = this.database.getRepositories().fonts.list();
    return c.json<FontSummary[], 200>(fonts.map(FontService.toSummary), 200);
  }

  // the raw file is the body; uploading a stored font again answers the stored one
  protected async upload(c: Context<AuthEnv>) {
    const bytes = await this.uploads.readBytes(c.req.raw);
    if (bytes.isErr()) return this.error(c, ApiErrorCodeEnum.FileTooLarge);

    const saved = await this.store.save(bytes.value);
    if (saved.isErr()) {
      if (!InvalidFontError.is(saved.error)) throw saved.error;
      return this.error(c, this.invalidFontCode(saved.error));
    }

    const { fonts } = this.database.getRepositories();
    const existing = fonts.findBySha256(saved.value.sha256);
    if (existing) {
      return c.json<FontSummary, 200>(FontService.toSummary(existing), 200);
    }

    const created = fonts.create({
      sha256: saved.value.sha256,
      family: saved.value.family,
      style: saved.value.style,
      source: FontSourceEnum.Upload,
      fileName: saved.value.fileName,
    });
    // the same font uploaded twice at once
    if (created.isErr()) {
      const stored = fonts.findBySha256(saved.value.sha256);
      if (!stored) throw created.error;
      return c.json<FontSummary, 200>(FontService.toSummary(stored), 200);
    }

    const font = created.value;
    this.auditLog.record({
      userId: c.get('user').id,
      action: AuditActionEnum.Create,
      entity: AuditEntityEnum.Font,
      entityId: font.id,
      details: { family: font.family, style: font.style },
    });
    return c.json<FontSummary, 201>(FontService.toSummary(font), 201);
  }

  // streamed without byte ranges, so the compressor still shrinks it
  protected async download(c: Context<AuthEnv>) {
    const sha256 = Sha256Schema.safeParse(c.req.param('sha256'));
    const font = sha256.success
      ? this.database.getRepositories().fonts.findBySha256(sha256.data)
      : null;
    if (!font) return this.error(c, ApiErrorCodeEnum.NotFound);

    const path = this.getFontPath(font);
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
      'Content-Type': FontService.ContentTypes[extension],
      'Content-Length': String(size),
      'Cache-Control': FontService.ImmutableCacheControl,
    });
  }

  protected invalidFontCode(error: InvalidFontError): ApiErrorCode {
    return FontService.InvalidFontCodes[error.reason];
  }

  protected error(c: Context<AuthEnv>, code: ApiErrorCode) {
    return apiError(c, FontService.ErrorStatuses[code] ?? 400, code);
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
}
