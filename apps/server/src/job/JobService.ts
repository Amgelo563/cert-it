import { ModelNotFoundError } from '@cert-it/data';
import type { JobId } from '@cert-it/jobs';
import {
  type ApiErrorCode,
  ApiErrorCodeEnum,
  type ApiPage,
  AuditActionEnum,
  AuditEntityEnum,
  type CertificateJobResult,
  type JobSummary,
  JobTypeEnum,
  type PageQuery,
  PageQuerySchema,
  PermissionEnum,
} from '@cert-it/shared';
import { type Context, Hono } from 'hono';
import type { ClientErrorStatusCode } from 'hono/utils/http-status';
import type { AuditLogService } from '../audit/AuditLogService';
import type { AuthEnv } from '../auth/AuthEnv';
import type { AuthGuard } from '../auth/AuthGuard';
import type { CourseId } from '../course/Course';
import type { DatabaseService } from '../database/DatabaseService';
import { apiError } from '../http/api/apiError';
import { apiValidator } from '../http/api/apiValidator';
import type { BackgroundJobService } from './BackgroundJobService';
import type { Job } from './Job';

type JobServiceOptions = {
  database: DatabaseService;
  guard: AuthGuard;
  auditLog: AuditLogService;
  jobs: BackgroundJobService;
};

/** Serves a course's job routes: anyone can follow a job's progress, and Editors run a failed one again. */
export class JobService {
  /** Path of the routes, relative to the base path. */
  public static readonly Path = '/api/courses/:courseId/jobs';

  protected static readonly ErrorStatuses: Partial<
    Record<ApiErrorCode, ClientErrorStatusCode>
  > = {
    [ApiErrorCodeEnum.NotFound]: 404,
    [ApiErrorCodeEnum.JobNotFailed]: 409,
  };

  protected readonly database: DatabaseService;

  protected readonly guard: AuthGuard;

  protected readonly auditLog: AuditLogService;

  protected readonly jobs: BackgroundJobService;

  protected readonly app: ReturnType<JobService['createApp']>;

  constructor(options: JobServiceOptions) {
    this.database = options.database;
    this.guard = options.guard;
    this.auditLog = options.auditLog;
    this.jobs = options.jobs;
    this.app = this.createApp();
  }

  public static create(options: {
    database: DatabaseService;
    guard: AuthGuard;
    auditLog: AuditLogService;
    jobs: BackgroundJobService;
    injections?: Partial<JobServiceOptions>;
  }): JobService {
    const { injections, ...defaults } = options;
    return new JobService({ ...defaults, ...injections });
  }

  /** Returns the summary the routes answer with for a job. */
  public static toSummary(this: void, job: Job): JobSummary {
    return {
      id: job.id,
      courseId: job.courseId,
      type: job.type,
      status: job.status,
      progress: job.progress,
      total: job.total,
      output: (job.output ?? null) as CertificateJobResult | null,
      error: job.error,
      createdAt: job.createdAt.toISOString(),
      startedAt: job.startedAt?.toISOString() ?? null,
      finishedAt: job.finishedAt?.toISOString() ?? null,
    };
  }

  /** Returns the routes, to mount at {@link JobService.Path}. */
  public getApp(): JobService['app'] {
    return this.app;
  }

  // chained, so hono/client can infer the routes' types
  protected createApp() {
    const { guard } = this;

    return new Hono<AuthEnv>({ strict: false })
      .use(guard.authenticate())
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
        '/:id/retry',
        guard.requirePermission(PermissionEnum.IssueCertificates),
        (c) => this.retry(c),
      );
  }

  // newest first, so the panel finds a running job after a reload
  protected list(c: Context<AuthEnv>, page: PageQuery) {
    const courseId = JobService.parseId(c.req.param('courseId'));
    const course =
      courseId === null
        ? null
        : this.database
            .getRepositories()
            .courses.findById(courseId as CourseId);
    if (!course) return this.error(c, ApiErrorCodeEnum.NotFound);

    const jobs = this.database
      .getRepositories()
      .jobs.listByCourse(course.id, page);
    return c.json<ApiPage<JobSummary>, 200>(
      { ...jobs, items: jobs.items.map(JobService.toSummary) },
      200,
    );
  }

  protected get(c: Context<AuthEnv>) {
    const job = this.findJob(c);
    if (!job) return this.error(c, ApiErrorCodeEnum.NotFound);

    return c.json<JobSummary, 200>(JobService.toSummary(job), 200);
  }

  // recorded as the job's own action, marked as a retry
  protected retry(c: Context<AuthEnv>) {
    const job = this.findJob(c);
    if (!job) return this.error(c, ApiErrorCodeEnum.NotFound);

    const retried = this.jobs.retry(job.id);
    if (retried.isErr()) {
      return this.error(
        c,
        retried.error instanceof ModelNotFoundError
          ? ApiErrorCodeEnum.NotFound
          : ApiErrorCodeEnum.JobNotFailed,
      );
    }

    this.auditLog.record({
      userId: c.get('user').id,
      action:
        job.type === JobTypeEnum.Issue
          ? AuditActionEnum.Issue
          : AuditActionEnum.Regenerate,
      entity: AuditEntityEnum.Job,
      entityId: job.id,
      details: { courseId: job.courseId, retry: true },
    });
    return c.json<JobSummary, 202>(JobService.toSummary(retried.value), 202);
  }

  // only a job of the course in the path
  protected findJob(c: Context<AuthEnv>): Job | null {
    const courseId = JobService.parseId(c.req.param('courseId'));
    const id = JobService.parseId(c.req.param('id'));
    if (courseId === null || id === null) return null;

    const job = this.database.getRepositories().jobs.findById(id as JobId);
    return job?.courseId === courseId ? job : null;
  }

  protected error(c: Context<AuthEnv>, code: ApiErrorCode) {
    return apiError(c, JobService.ErrorStatuses[code] ?? 400, code);
  }

  protected static parseId(value: string | undefined): number | null {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  }
}
