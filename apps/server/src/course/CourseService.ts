import { ModelNotFoundError } from '@cert-it/data';
import {
  type ApiErrorCode,
  ApiErrorCodeEnum,
  type ApiPage,
  type AuditAction,
  AuditActionEnum,
  AuditEntityEnum,
  CertificateStatusEnum,
  CourseDateFormatter,
  type CourseSummary,
  type CreateCourseRequest,
  CreateCourseRequestSchema,
  type Locale,
  type PageQuery,
  PageQuerySchema,
  PermissionEnum,
  type UpdateCourseRequest,
  UpdateCourseRequestSchema,
} from '@cert-it/shared';
import { type Context, Hono } from 'hono';
import type { ClientErrorStatusCode } from 'hono/utils/http-status';
import type { AuditLogService } from '../audit/AuditLogService';
import type { AuthEnv } from '../auth/AuthEnv';
import type { AuthGuard } from '../auth/AuthGuard';
import type { CertificateCounts } from '../certificate/CertificateCounts';
import type { Config } from '../config/schema/ConfigSchema';
import type { DatabaseService } from '../database/DatabaseService';
import { apiError } from '../http/api/apiError';
import { apiValidator } from '../http/api/apiValidator';
import { jsonBodyLimit } from '../http/api/jsonBodyLimit';
import type { Course, CourseId } from './Course';

type CourseServiceOptions = {
  database: DatabaseService;
  guard: AuthGuard;
  auditLog: AuditLogService;
  /** Locale of new courses that don't pick one, as in site.default_locale. */
  defaultLocale: Locale;
};

/** Serves the course routes: anyone can read them, Editors change them and Admins delete them. */
export class CourseService {
  /** Path of the routes, relative to the base path. */
  public static readonly Path = '/api/courses';

  protected static readonly ErrorStatuses: Partial<
    Record<ApiErrorCode, ClientErrorStatusCode>
  > = {
    [ApiErrorCodeEnum.NotFound]: 404,
  };

  protected static readonly NoCertificates: CertificateCounts = {
    [CertificateStatusEnum.Active]: 0,
    [CertificateStatusEnum.Revoked]: 0,
  };

  protected readonly database: DatabaseService;

  protected readonly guard: AuthGuard;

  protected readonly auditLog: AuditLogService;

  protected readonly defaultLocale: Locale;

  protected readonly app: ReturnType<CourseService['createApp']>;

  constructor(options: CourseServiceOptions) {
    this.database = options.database;
    this.guard = options.guard;
    this.auditLog = options.auditLog;
    this.defaultLocale = options.defaultLocale;
    this.app = this.createApp();
  }

  public static create(options: {
    config: Config;
    database: DatabaseService;
    guard: AuthGuard;
    auditLog: AuditLogService;
    injections?: Partial<CourseServiceOptions>;
  }): CourseService {
    const { config, injections } = options;

    return new CourseService({
      database: injections?.database ?? options.database,
      guard: injections?.guard ?? options.guard,
      auditLog: injections?.auditLog ?? options.auditLog,
      defaultLocale: injections?.defaultLocale ?? config.site.defaultLocale,
    });
  }

  /** Returns the routes, to mount at {@link CourseService.Path}. */
  public getApp(): CourseService['app'] {
    return this.app;
  }

  // chained, so hono/client can infer the routes' types
  protected createApp() {
    const { guard } = this;

    return new Hono<AuthEnv>({ strict: false })
      .use(jsonBodyLimit(), guard.authenticate())
      .get(
        '/',
        guard.requirePermission(PermissionEnum.ViewRecords),
        apiValidator('query', PageQuerySchema),
        (c) => this.list(c, c.req.valid('query')),
      )
      .get('/:id', guard.requirePermission(PermissionEnum.ViewRecords), (c) =>
        this.get(c),
      )
      .post(
        '/',
        guard.requirePermission(PermissionEnum.EditCourses),
        apiValidator('json', CreateCourseRequestSchema),
        (c) => this.add(c, c.req.valid('json')),
      )
      .patch(
        '/:id',
        guard.requirePermission(PermissionEnum.EditCourses),
        apiValidator('json', UpdateCourseRequestSchema),
        (c) => this.update(c, c.req.valid('json')),
      )
      .delete(
        '/:id',
        guard.requirePermission(PermissionEnum.DeleteRecords),
        (c) => this.remove(c),
      );
  }

  protected list(c: Context<AuthEnv>, query: PageQuery) {
    const page = this.database.getRepositories().courses.list(query);
    return c.json<ApiPage<CourseSummary>, 200>(
      { ...page, items: this.toSummaries(page.items) },
      200,
    );
  }

  protected get(c: Context<AuthEnv>) {
    const course = this.findCourse(c);
    if (!course) return this.error(c, ApiErrorCodeEnum.NotFound);

    const [summary] = this.toSummaries([course]);
    return c.json<CourseSummary, 200>(summary!, 200);
  }

  protected add(c: Context<AuthEnv>, body: CreateCourseRequest) {
    const locale = body.locale ?? this.defaultLocale;
    const course = this.database
      .getRepositories()
      .courses.create({
        name: body.name,
        locale,
        dateFormat:
          body.dateFormat ?? CourseDateFormatter.DefaultFormats[locale],
        lookupEnabled: body.lookupEnabled,
      })
      .unwrap();

    this.audit(c, course, AuditActionEnum.Create, { name: course.name });
    const [summary] = this.toSummaries([course]);
    return c.json<CourseSummary, 201>(summary!, 201);
  }

  protected update(c: Context<AuthEnv>, body: UpdateCourseRequest) {
    const id = CourseService.parseId(c);
    if (id === null) return this.error(c, ApiErrorCodeEnum.NotFound);

    const updated = this.database.getRepositories().courses.update(id, body);
    if (updated.isErr()) {
      if (!(updated.error instanceof ModelNotFoundError)) throw updated.error;
      return this.error(c, ApiErrorCodeEnum.NotFound);
    }

    const course = updated.value;
    this.audit(c, course, AuditActionEnum.Update, { ...body });
    const [summary] = this.toSummaries([course]);
    return c.json<CourseSummary, 200>(summary!, 200);
  }

  // the name goes in the audit entry, since the course won't be there to look up
  protected remove(c: Context<AuthEnv>) {
    const course = this.findCourse(c);
    if (!course) return this.error(c, ApiErrorCodeEnum.NotFound);

    const deleted = this.database.getRepositories().courses.delete(course.id);
    if (deleted.isErr()) return this.error(c, ApiErrorCodeEnum.NotFound);

    this.audit(c, course, AuditActionEnum.Delete, { name: course.name });
    return c.body(null, 204);
  }

  protected findCourse(c: Context<AuthEnv>): Course | null {
    const id = CourseService.parseId(c);
    if (id === null) return null;
    return this.database.getRepositories().courses.findById(id);
  }

  // three queries for the whole page, not three per course
  protected toSummaries(courses: readonly Course[]): CourseSummary[] {
    const { participants, certificates, templateVersions } =
      this.database.getRepositories();
    const ids = courses.map((course) => course.id);
    const participantCounts = participants.countByCourses(ids);
    const certificateCounts = certificates.countByCourses(ids);
    const latestVersions = templateVersions.findLatestVersionNumbers(ids);

    return courses.map((course) => ({
      id: course.id,
      name: course.name,
      locale: course.locale,
      dateFormat: course.dateFormat,
      lookupEnabled: course.lookupEnabled,
      active: course.active,
      createdAt: course.createdAt.toISOString(),
      participantCount: participantCounts.get(course.id) ?? 0,
      latestTemplateVersion: latestVersions.get(course.id) ?? null,
      certificateCounts:
        certificateCounts.get(course.id) ?? CourseService.NoCertificates,
    }));
  }

  protected audit(
    c: Context<AuthEnv>,
    target: Course,
    action: AuditAction,
    details?: Readonly<Record<string, unknown>>,
  ): void {
    this.auditLog.record({
      userId: c.get('user').id,
      action,
      entity: AuditEntityEnum.Course,
      entityId: target.id,
      details,
    });
  }

  protected error(c: Context<AuthEnv>, code: ApiErrorCode) {
    return apiError(c, CourseService.ErrorStatuses[code] ?? 400, code);
  }

  protected static parseId(c: Context): CourseId | null {
    const id = Number(c.req.param('id'));
    return Number.isSafeInteger(id) && id > 0 ? (id as CourseId) : null;
  }
}
