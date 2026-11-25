import { access } from 'node:fs/promises';
import { basename } from 'node:path';
import { FileStreamer } from '@cert-it/hono';
import {
  type ApiErrorCode,
  ApiErrorCodeEnum,
  type BasePdfUpload,
  CourseFieldTypeEnum,
  parseCourseFieldTemplateType,
  LargeBasePdfBytes,
  PermissionEnum,
  type SaveTemplateRequest,
  SaveTemplateRequestSchema,
  Sha256Schema,
  type TemplateContent,
  type TemplateDetail,
  TemplateFieldTypeEnum,
  FileSystemError,
} from '@cert-it/shared';
import { type Context, Hono } from 'hono';
import type { ClientErrorStatusCode } from 'hono/utils/http-status';
import type { AuditLog } from '../audit/AuditLog';
import type { AuthGuard } from '../auth/AuthGuard';
import type { Config } from '../config/schema/ConfigSchema';
import type { DatabaseService } from '../database/DatabaseService';
import { FontRoutes } from '../font/FontRoutes';
import { AbstractApiRoutes } from '../http/api/AbstractApiRoutes';
import { UploadReader } from '../http/upload/UploadReader';
import type { DataDirectoryService } from '../storage/DataDirectoryService';
import { BasePdfChecker } from './pdf/BasePdfChecker';
import {
  type BasePdfProblem,
  BasePdfProblemEnum,
} from './pdf/BasePdfProblemEnum';
import type { TemplateVersion } from './TemplateVersion';
import { TemplateVersionWriter } from './TemplateVersionWriter';
import type { CourseId } from '../course/Course';
import type { CourseEnv } from '../course/CourseEnv';
import { CourseLoader } from '../course/CourseLoader';

type TemplateRoutesOptions = {
  database: DatabaseService;
  dataDirectory: DataDirectoryService;
  guard: AuthGuard;
  courseLoader: CourseLoader;
  auditLog: AuditLog;
  uploads: UploadReader;
  pdfChecker: BasePdfChecker;
  writer: TemplateVersionWriter;
};

/** Serves a course's template routes: anyone can read the template, Editors upload base PDFs and save new versions. */
export class TemplateRoutes extends AbstractApiRoutes {
  /** Path of the routes, relative to the base path. */
  public static readonly Path = '/api/courses/:courseId/template';

  // a template is a few fields, but each keeps every pdfme property
  protected static readonly MaxTemplateBytes = 256 * 1024;

  protected static override readonly ErrorStatuses: Partial<
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

  protected readonly courseLoader: CourseLoader;

  protected readonly auditLog: AuditLog;

  protected readonly uploads: UploadReader;

  protected readonly pdfChecker: BasePdfChecker;

  protected readonly writer: TemplateVersionWriter;

  protected readonly app: ReturnType<TemplateRoutes['createApp']>;

  constructor(options: TemplateRoutesOptions) {
    super();
    this.database = options.database;
    this.dataDirectory = options.dataDirectory;
    this.guard = options.guard;
    this.courseLoader = options.courseLoader;
    this.auditLog = options.auditLog;
    this.uploads = options.uploads;
    this.pdfChecker = options.pdfChecker;
    this.writer = options.writer;
    this.app = this.createApp();
  }

  public static create(options: {
    config: Pick<Config, 'uploads'>;
    database: DatabaseService;
    dataDirectory: DataDirectoryService;
    guard: AuthGuard;
    auditLog: AuditLog;
    injections?: Partial<
      Pick<
        TemplateRoutesOptions,
        'uploads' | 'pdfChecker' | 'courseLoader' | 'writer'
      >
    >;
  }): TemplateRoutes {
    const { config, injections, ...shared } = options;

    return new TemplateRoutes({
      ...shared,
      courseLoader:
        injections?.courseLoader
        ?? CourseLoader.create({ database: shared.database }),
      uploads:
        injections?.uploads
        ?? new UploadReader({
          maxBytes: config.uploads.maxPdfMb * 1024 * 1024,
        }),
      pdfChecker: injections?.pdfChecker ?? BasePdfChecker.create(),
      writer:
        injections?.writer
        ?? new TemplateVersionWriter({
          database: shared.database,
          auditLog: shared.auditLog,
        }),
    });
  }

  /** Returns the routes, to mount at {@link TemplateRoutes.Path}. */
  public getApp(): TemplateRoutes['app'] {
    return this.app;
  }

  // chained, so hono/client can infer the routes' types
  protected createApp() {
    const { guard } = this;

    return new Hono<CourseEnv>({ strict: false })
      .use(guard.authenticate())
      .get(
        '/',
        guard.requirePermission(PermissionEnum.ViewRecords),
        this.courseLoader.middleware(),
        (c) => this.getLatest(c),
      )
      .post(
        '/',
        guard.requirePermission(PermissionEnum.EditCourses),
        TemplateRoutes.bodyLimit(TemplateRoutes.MaxTemplateBytes),
        TemplateRoutes.validator('json', SaveTemplateRequestSchema),
        this.courseLoader.middleware(),
        (c) => this.save(c, c.req.valid('json')),
      )
      .post(
        '/base-pdf',
        guard.requirePermission(PermissionEnum.EditCourses),
        this.courseLoader.middleware(),
        (c) => this.uploadBasePdf(c),
      )
      .get(
        '/base-pdf/:sha256',
        guard.requirePermission(PermissionEnum.ViewRecords),
        this.courseLoader.middleware(),
        (c) => this.downloadBasePdf(c),
      );
  }

  // null when the course has no template yet
  protected getLatest(c: Context<CourseEnv>) {
    const course = c.get('course');

    const latest = this.database
      .getRepositories()
      .templateVersions.findLatest(course.id);
    return c.json<TemplateDetail | null, 200>(
      latest ? this.toDetail(latest) : null,
      200,
    );
  }

  // the version number and its fonts are written in one transaction
  protected async save(c: Context<CourseEnv>, body: SaveTemplateRequest) {
    const course = c.get('course');

    const basePdfPath = this.dataDirectory.getTemplateFile(
      course.id,
      body.basePdf,
    );
    if (!(await this.exists(basePdfPath))) {
      return this.error(c, ApiErrorCodeEnum.UnknownBasePdf);
    }

    if (!this.writer.findFonts(body.template)) {
      return this.error(c, ApiErrorCodeEnum.UnknownFont);
    }
    if (!this.hasKnownFields(course.id, body.template)) {
      return this.error(c, ApiErrorCodeEnum.UnknownField);
    }

    const saved = this.writer.save({
      courseId: course.id,
      template: body.template,
      basePdfPath,
      userId: c.get('user').id,
    });

    return c.json<TemplateDetail, 201>(this.toDetail(saved), 201);
  }

  // streamed to a temporary file, checked in a worker, then stored by its hash
  protected async uploadBasePdf(c: Context<CourseEnv>) {
    const course = c.get('course');

    const upload = this.dataDirectory.createUploadPath();
    const saved = await this.uploads.saveToFile(c.req.raw, upload);
    if (saved.isErr()) return this.error(c, ApiErrorCodeEnum.FileTooLarge);

    try {
      const checked = await this.pdfChecker.check(upload);
      if (checked.isErr()) {
        return this.error(
          c,
          TemplateRoutes.ProblemCodes[checked.error.problem],
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

  protected async downloadBasePdf(c: Context<CourseEnv>) {
    const course = c.get('course');
    const sha256 = Sha256Schema.safeParse(c.req.param('sha256'));
    if (!sha256.success) {
      return this.error(c, ApiErrorCodeEnum.NotFound);
    }

    const sent = await FileStreamer.Instance.send(
      c,
      this.dataDirectory.getTemplatePath(course.id, sha256.data),
      {
        'Content-Type': 'application/pdf',
        'Cache-Control': FontRoutes.ImmutableCacheControl,
      },
    );
    if (sent.isOk()) return sent.value;
    if (FileSystemError.is(sent.error)) throw sent.error.cause;
    return this.error(c, ApiErrorCodeEnum.NotFound);
  }

  // images only from image fields, text from the others
  protected hasKnownFields(
    courseId: CourseId,
    template: TemplateContent,
  ): boolean {
    const fields = new Map(
      this.database
        .getRepositories()
        .courseFields.listByCourse(courseId)
        .map((field) => [field.id as number, field]),
    );

    return template.schemas.flat().every((placed) => {
      const course = parseCourseFieldTemplateType(placed.type);
      if (!course) return true;
      const field = fields.get(course.fieldId);
      if (!field) return false;
      const image = field.type === CourseFieldTypeEnum.Image;
      return image === (course.kind === TemplateFieldTypeEnum.FieldImage);
    });
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
      fonts: used.map(FontRoutes.toSummary),
      createdAt: version.createdAt.toISOString(),
    };
  }
}
