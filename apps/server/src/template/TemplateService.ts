import { access } from 'node:fs/promises';
import { basename } from 'node:path';
import { FileStreamer } from '@cert-it/hono';
import {
  type ApiErrorCode,
  ApiErrorCodeEnum,
  AuditActionEnum,
  AuditEntityEnum,
  type BasePdfUpload,
  LargeBasePdfBytes,
  PermissionEnum,
  type SaveTemplateRequest,
  SaveTemplateRequestSchema,
  Sha256Schema,
  type TemplateContent,
  type TemplateDetail,
  FileSystemError,
} from '@cert-it/shared';
import { type Context, Hono } from 'hono';
import type { ClientErrorStatusCode } from 'hono/utils/http-status';
import type { AuditLogService } from '../audit/AuditLogService';
import type { AuthEnv } from '../auth/AuthEnv';
import type { AuthGuard } from '../auth/AuthGuard';
import type { Config } from '../config/schema/ConfigSchema';
import type { Course, CourseId } from '../course/Course';
import type { DatabaseService } from '../database/DatabaseService';
import type { Font } from '../font/Font';
import { FontService } from '../font/FontService';
import { apiError } from '../http/api/apiError';
import { apiValidator } from '../http/api/apiValidator';
import { jsonBodyLimit } from '../http/api/jsonBodyLimit';
import { UploadReader } from '../http/upload/UploadReader';
import type { DataDirectoryService } from '../storage/DataDirectoryService';
import { BasePdfChecker } from './pdf/BasePdfChecker';
import {
  type BasePdfProblem,
  BasePdfProblemEnum,
} from './pdf/BasePdfProblemEnum';
import { listTextFields } from './listTextFields';
import type { TemplateVersion } from './TemplateVersion';

type TemplateServiceOptions = {
  database: DatabaseService;
  dataDirectory: DataDirectoryService;
  guard: AuthGuard;
  auditLog: AuditLogService;
  uploads: UploadReader;
  pdfChecker: BasePdfChecker;
};

/** Serves a course's template routes: anyone can read the template, Editors upload base PDFs and save new versions. */
export class TemplateService {
  /** Path of the routes, relative to the base path. */
  public static readonly Path = '/api/courses/:courseId/template';

  // a template is a few fields, but each keeps every pdfme property
  protected static readonly MaxTemplateBytes = 256 * 1024;

  protected static readonly ErrorStatuses: Partial<
    Record<ApiErrorCode, ClientErrorStatusCode>
  > = {
    [ApiErrorCodeEnum.NotFound]: 404,
    [ApiErrorCodeEnum.FileTooLarge]: 413,
  };

  protected static readonly ProblemCodes: Record<BasePdfProblem, ApiErrorCode> =
    {
      [BasePdfProblemEnum.Invalid]: ApiErrorCodeEnum.InvalidPdf,
      [BasePdfProblemEnum.Encrypted]: ApiErrorCodeEnum.EncryptedPdf,
      [BasePdfProblemEnum.NotOnePage]: ApiErrorCodeEnum.PdfNotOnePage,
    };

  protected readonly database: DatabaseService;

  protected readonly dataDirectory: DataDirectoryService;

  protected readonly guard: AuthGuard;

  protected readonly auditLog: AuditLogService;

  protected readonly uploads: UploadReader;

  protected readonly pdfChecker: BasePdfChecker;

  protected readonly app: ReturnType<TemplateService['createApp']>;

  constructor(options: TemplateServiceOptions) {
    this.database = options.database;
    this.dataDirectory = options.dataDirectory;
    this.guard = options.guard;
    this.auditLog = options.auditLog;
    this.uploads = options.uploads;
    this.pdfChecker = options.pdfChecker;
    this.app = this.createApp();
  }

  public static create(options: {
    config: Config;
    database: DatabaseService;
    dataDirectory: DataDirectoryService;
    guard: AuthGuard;
    auditLog: AuditLogService;
    injections?: Partial<TemplateServiceOptions>;
  }): TemplateService {
    const { config, injections } = options;

    return new TemplateService({
      database: injections?.database ?? options.database,
      dataDirectory: injections?.dataDirectory ?? options.dataDirectory,
      guard: injections?.guard ?? options.guard,
      auditLog: injections?.auditLog ?? options.auditLog,
      uploads:
        injections?.uploads
        ?? new UploadReader({
          maxBytes: config.uploads.maxPdfMb * 1024 * 1024,
        }),
      pdfChecker: injections?.pdfChecker ?? new BasePdfChecker(),
    });
  }

  /** Returns the routes, to mount at {@link TemplateService.Path}. */
  public getApp(): TemplateService['app'] {
    return this.app;
  }

  // chained, so hono/client can infer the routes' types
  protected createApp() {
    const { guard } = this;

    return new Hono<AuthEnv>({ strict: false })
      .use(guard.authenticate())
      .get('/', guard.requirePermission(PermissionEnum.ViewRecords), (c) =>
        this.getLatest(c),
      )
      .post(
        '/',
        guard.requirePermission(PermissionEnum.EditCourses),
        jsonBodyLimit(TemplateService.MaxTemplateBytes),
        apiValidator('json', SaveTemplateRequestSchema),
        (c) => this.save(c, c.req.valid('json')),
      )
      .post(
        '/base-pdf',
        guard.requirePermission(PermissionEnum.EditCourses),
        (c) => this.uploadBasePdf(c),
      )
      .get(
        '/base-pdf/:sha256',
        guard.requirePermission(PermissionEnum.ViewRecords),
        (c) => this.downloadBasePdf(c),
      );
  }

  // null when the course has no template yet
  protected getLatest(c: Context<AuthEnv>) {
    const course = this.findCourse(c);
    if (!course) return this.error(c, ApiErrorCodeEnum.NotFound);

    const latest = this.database
      .getRepositories()
      .templateVersions.findLatest(course.id);
    return c.json<TemplateDetail | null, 200>(
      latest ? this.toDetail(latest) : null,
      200,
    );
  }

  // the version number and its fonts are written in one transaction
  protected async save(c: Context<AuthEnv>, body: SaveTemplateRequest) {
    const course = this.findCourse(c);
    if (!course) return this.error(c, ApiErrorCodeEnum.NotFound);

    const basePdfPath = this.dataDirectory.getTemplateFile(
      course.id,
      body.basePdf,
    );
    if (!(await this.exists(basePdfPath))) {
      return this.error(c, ApiErrorCodeEnum.UnknownBasePdf);
    }

    const fonts = this.findFonts(body.template);
    if (!fonts) return this.error(c, ApiErrorCodeEnum.UnknownFont);

    const userId = c.get('user').id;
    const saved = this.database
      .getUnitOfWork()
      .transaction(({ templateVersions }) => {
        const version =
          (templateVersions.findLatest(course.id)?.version ?? 0) + 1;
        return templateVersions
          .create({
            courseId: course.id,
            version,
            template: body.template,
            basePdfPath,
            createdBy: userId,
          })
          .map((created) => {
            templateVersions.setFontIds(
              created.id,
              fonts.map((font) => font.id),
            );
            return created;
          });
      })
      .unwrap();

    this.auditLog.record({
      userId,
      action: AuditActionEnum.Create,
      entity: AuditEntityEnum.TemplateVersion,
      entityId: saved.id,
      details: { courseId: course.id, version: saved.version },
    });
    return c.json<TemplateDetail, 201>(this.toDetail(saved), 201);
  }

  // streamed to a temporary file, checked in a worker, then stored by its hash
  protected async uploadBasePdf(c: Context<AuthEnv>) {
    const course = this.findCourse(c);
    if (!course) return this.error(c, ApiErrorCodeEnum.NotFound);

    const upload = this.dataDirectory.createUploadPath();
    const saved = await this.uploads.saveToFile(c.req.raw, upload);
    if (saved.isErr()) return this.error(c, ApiErrorCodeEnum.FileTooLarge);

    try {
      const checked = await this.pdfChecker.check(upload);
      if (checked.isErr()) {
        return this.error(
          c,
          TemplateService.ProblemCodes[checked.error.problem],
        );
      }

      const { sha256, bytes } = saved.value;
      await this.dataDirectory.moveFile(
        upload,
        this.dataDirectory.getTemplateFile(course.id, sha256),
      );
      return c.json<BasePdfUpload, 201>(
        { basePdf: sha256, bytes, large: bytes > LargeBasePdfBytes },
        201,
      );
    } finally {
      await this.dataDirectory.deleteFile(upload);
    }
  }

  protected async downloadBasePdf(c: Context<AuthEnv>) {
    const course = this.findCourse(c);
    const sha256 = Sha256Schema.safeParse(c.req.param('sha256'));
    if (!course || !sha256.success) {
      return this.error(c, ApiErrorCodeEnum.NotFound);
    }

    const sent = await FileStreamer.Instance.send(
      c,
      this.dataDirectory.getTemplatePath(course.id, sha256.data),
      {
        'Content-Type': 'application/pdf',
        'Cache-Control': FontService.ImmutableCacheControl,
      },
    );
    if (sent.isOk()) return sent.value;
    if (FileSystemError.is(sent.error)) throw sent.error.cause;
    return this.error(c, ApiErrorCodeEnum.NotFound);
  }

  // null if a field names a font that isn't stored
  protected findFonts(template: TemplateContent): Font[] | null {
    const { fonts } = this.database.getRepositories();
    const hashes = new Set(
      listTextFields(template).map((field) => field.fontName),
    );
    const found = [...hashes].map((sha256) => fonts.findBySha256(sha256));

    return found.every((font) => font !== null) ? found : null;
  }

  protected findCourse(c: Context<AuthEnv>): Course | null {
    const id = Number(c.req.param('courseId'));
    if (!Number.isSafeInteger(id) || id <= 0) return null;
    return this.database.getRepositories().courses.findById(id as CourseId);
  }

  protected async exists(path: string): Promise<boolean> {
    return access(this.dataDirectory.resolve(path)).then(
      () => true,
      () => false,
    );
  }

  protected toDetail(version: TemplateVersion): TemplateDetail {
    const { fonts, templateVersions } = this.database.getRepositories();
    const used = templateVersions
      .listFontIds(version.id)
      .flatMap((id) => fonts.findById(id) ?? []);

    return {
      id: version.id,
      courseId: version.courseId,
      version: version.version,
      // checked against the schema when it was saved
      template: version.template as TemplateContent,
      basePdf: basename(version.basePdfPath, '.pdf'),
      fonts: used.map(FontService.toSummary),
      createdAt: version.createdAt.toISOString(),
    };
  }

  protected error(c: Context<AuthEnv>, code: ApiErrorCode) {
    return apiError(c, TemplateService.ErrorStatuses[code] ?? 400, code);
  }
}
