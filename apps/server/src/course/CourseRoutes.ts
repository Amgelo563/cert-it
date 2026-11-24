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
  type TemplateContent,
  type UpdateCourseRequest,
  UpdateCourseRequestSchema,
  hasParticipantNameField,
} from '@cert-it/shared';
import { type Context, Hono } from 'hono';
import type { ClientErrorStatusCode } from 'hono/utils/http-status';
import type { AuditLog } from '../audit/AuditLog';
import type { AuthEnv } from '../auth/AuthEnv';
import type { AuthGuard } from '../auth/AuthGuard';
import type { CertificateCounts } from '../certificate/CertificateCounts';
import type { Config } from '../config/schema/ConfigSchema';
import type { DatabaseService } from '../database/DatabaseService';
import type { DataDirectoryService } from '../storage/DataDirectoryService';
import { AbstractApiRoutes } from '../http/api/AbstractApiRoutes';
import type { Course } from './Course';
import { ConsoleLogger } from '../log/ConsoleLogger';
import type { Logger } from '../log/Logger';
import type { CourseEnv } from './CourseEnv';
import { CourseLoader } from './CourseLoader';
import type { UserId } from '../user/User';

type CourseRoutesOptions = {
  database: DatabaseService;
  guard: AuthGuard;
  auditLog: AuditLog;
  courseLoader: CourseLoader;
  /** Locale of new courses that don't pick one, as in site.default_locale. */
  defaultLocale: Locale;
  /** Where the course's certificate PDFs are, to delete them with it. */
  dataDirectory: DataDirectoryService;
  logger: Logger;
};

/** Serves the course routes: anyone can read them, Editors change them and Admins delete them. */
export class CourseRoutes extends AbstractApiRoutes {
  /** Path of the routes, relative to the base path. */
  public static readonly Path = '/api/courses';

  protected static override readonly ErrorStatuses: Partial<
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

  protected readonly auditLog: AuditLog;

  protected readonly courseLoader: CourseLoader;

  protected readonly defaultLocale: Locale;

  protected readonly dataDirectory: DataDirectoryService;

  protected readonly logger: Logger;

  protected readonly app: ReturnType<CourseRoutes['createApp']>;

  constructor(options: CourseRoutesOptions) {
    super();
    this.database = options.database;
    this.guard = options.guard;
    this.auditLog = options.auditLog;
    this.courseLoader = options.courseLoader;
    this.defaultLocale = options.defaultLocale;
    this.dataDirectory = options.dataDirectory;
    this.logger = options.logger;
    this.app = this.createApp();
  }

  public static create(options: {
    config: Pick<Config, 'site'>;
    database: DatabaseService;
    dataDirectory: DataDirectoryService;
    guard: AuthGuard;
    auditLog: AuditLog;
    injections?: Partial<
      Pick<CourseRoutesOptions, 'defaultLocale' | 'logger' | 'courseLoader'>
    >;
  }): CourseRoutes {
    const { config, injections, ...shared } = options;

    return new CourseRoutes({
      ...shared,
      courseLoader:
        injections?.courseLoader
        ?? CourseLoader.create({ database: shared.database }),
      defaultLocale: injections?.defaultLocale ?? config.site.defaultLocale,
      logger: injections?.logger ?? ConsoleLogger.Instance,
    });
  }

  /** Returns the routes, to mount at {@link CourseRoutes.Path}. */
  public getApp(): CourseRoutes['app'] {
    return this.app;
  }

  // chained, so hono/client can infer the routes' types
  protected createApp() {
    const { guard } = this;

    return (
      new Hono<AuthEnv>({ strict: false })
        // no body limit here: it would reach the participant routes under this path
        .use(guard.authenticate())
        .get(
          '/',
          guard.requirePermission(PermissionEnum.ViewRecords),
          CourseRoutes.validator('query', PageQuerySchema),
          (c) => this.list(c, c.req.valid('query')),
        )
        .get(
          '/:id',
          guard.requirePermission(PermissionEnum.ViewRecords),
          this.courseLoader.middleware('id'),
          (c) => this.get(c),
        )
        .post(
          '/',
          guard.requirePermission(PermissionEnum.EditCourses),
          CourseRoutes.bodyLimit(),
          CourseRoutes.validator('json', CreateCourseRequestSchema),
          (c) => this.add(c, c.req.valid('json')),
        )
        .patch(
          '/:id',
          guard.requirePermission(PermissionEnum.EditCourses),
          CourseRoutes.bodyLimit(),
          CourseRoutes.validator('json', UpdateCourseRequestSchema),
          this.courseLoader.middleware('id'),
          (c) => this.update(c, c.req.valid('json')),
        )
        .delete(
          '/:id',
          guard.requirePermission(PermissionEnum.DeleteRecords),
          this.courseLoader.middleware('id'),
          (c) => this.remove(c),
        )
    );
  }

  protected list(c: Context<AuthEnv>, query: PageQuery) {
    const page = this.database.getRepositories().courses.list(query);
    return c.json<ApiPage<CourseSummary>, 200>(
      { ...page, items: this.toSummaries(page.items) },
      200,
    );
  }

  protected get(c: Context<CourseEnv>) {
    const course = c.get('course');
    const [summary] = this.toSummaries([course]);
    return c.json<CourseSummary, 200>(summary!, 200);
  }

  protected add(c: Context<AuthEnv>, body: CreateCourseRequest) {
    const locale = body.locale ?? this.defaultLocale;
    const course = this.database.atomically(() => {
      const created = this.database
        .getRepositories()
        .courses.create({
          name: body.name,
          locale,
          dateFormat:
            body.dateFormat ?? CourseDateFormatter.DefaultFormats[locale],
          lookupEnabled: body.lookupEnabled,
        })
        .unwrap();
      this.audit(c.get('user').id, created, AuditActionEnum.Create, {
        name: created.name,
      });
      return created;
    });

    const [summary] = this.toSummaries([course]);
    return c.json<CourseSummary, 201>(summary!, 201);
  }

  protected update(c: Context<CourseEnv>, body: UpdateCourseRequest) {
    const { id } = c.get('course');
    const updated = this.database.getUnitOfWork().transaction(({ courses }) =>
      courses.update(id, body).map((course) => {
        this.audit(c.get('user').id, course, AuditActionEnum.Update, {
          ...body,
        });
        return course;
      }),
    );
    if (updated.isErr()) {
      if (!(updated.error instanceof ModelNotFoundError)) throw updated.error;
      return this.error(c, ApiErrorCodeEnum.NotFound);
    }

    const course = updated.value;
    const [summary] = this.toSummaries([course]);
    return c.json<CourseSummary, 200>(summary!, 200);
  }

  // the name goes in the audit entry, since the course won't be there to look up
  // the row goes first, so a file left behind never belongs to a live course
  protected async remove(c: Context<CourseEnv>) {
    const course = c.get('course');

    const deleted = this.database.getUnitOfWork().transaction(({ courses }) =>
      courses.delete(course.id).map(() => {
        this.audit(c.get('user').id, course, AuditActionEnum.Delete, {
          name: course.name,
        });
      }),
    );
    if (deleted.isErr()) return this.error(c, ApiErrorCodeEnum.NotFound);

    await Promise.all([
      this.dataDirectory
        .deleteCertificateFolder(course.id)
        .catch((error: unknown) => {
          this.logger.error(
            `Couldn't delete the certificates of course ${course.id}: ${String(error)}`,
          );
        }),
      this.dataDirectory
        .deleteTemplateFolder(course.id)
        .catch((error: unknown) => {
          this.logger.error(
            `Couldn't delete the templates of course ${course.id}: ${String(error)}`,
          );
        }),
    ]);
    return c.body(null, 204);
  }

  // three queries for the whole page, not three per course
  protected toSummaries(courses: readonly Course[]): CourseSummary[] {
    const { participants, certificates, templateVersions } =
      this.database.getRepositories();
    const ids = courses.map((course) => course.id);
    const participantCounts = participants.countByCourses(ids);
    const certificateCounts = certificates.countByCourses(ids);
    const latestVersions = templateVersions.findLatestByCourses(ids);

    return courses.map((course) => {
      const latest = latestVersions.get(course.id);
      return {
        id: course.id,
        name: course.name,
        locale: course.locale,
        dateFormat: course.dateFormat,
        lookupEnabled: course.lookupEnabled,
        active: course.active,
        createdAt: course.createdAt.toISOString(),
        participantCount: participantCounts.get(course.id) ?? 0,
        latestTemplateVersion: latest?.version ?? null,
        latestTemplateHasName: latest
          ? hasParticipantNameField(latest.template as TemplateContent)
          : false,
        certificateCounts:
          certificateCounts.get(course.id) ?? CourseRoutes.NoCertificates,
      };
    });
  }

  protected audit(
    userId: UserId,
    target: Course,
    action: AuditAction,
    details?: Readonly<Record<string, unknown>>,
  ): void {
    this.auditLog.record({
      userId,
      action,
      entity: AuditEntityEnum.Course,
      entityId: target.id,
      details,
    });
  }
}
