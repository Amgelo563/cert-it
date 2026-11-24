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
import type { AuditLog } from '../audit/AuditLog';
import type { AuthGuard } from '../auth/AuthGuard';
import type { DatabaseService } from '../database/DatabaseService';
import { AbstractApiRoutes } from '../http/api/AbstractApiRoutes';
import type { BackgroundJobService } from './BackgroundJobService';
import type { Job } from './Job';
import type { CourseEnv } from '../course/CourseEnv';
import { CourseLoader } from '../course/CourseLoader';

type JobRoutesOptions = {
  database: DatabaseService;
  guard: AuthGuard;
  courseLoader: CourseLoader;
  auditLog: AuditLog;
  jobs: BackgroundJobService;
};

/** Serves a course's job routes: anyone can follow a job's progress, and Editors run a failed one again. */
export class JobRoutes extends AbstractApiRoutes {
  /** Path of the routes, relative to the base path. */
  public static readonly Path = '/api/courses/:courseId/jobs';

  protected static override readonly ErrorStatuses: Partial<
    Record<ApiErrorCode, ClientErrorStatusCode>
  > = {
    [ApiErrorCodeEnum.NotFound]: 404,
    [ApiErrorCodeEnum.JobNotFailed]: 409,
  };

  protected readonly database: DatabaseService;

  protected readonly guard: AuthGuard;

  protected readonly courseLoader: CourseLoader;

  protected readonly auditLog: AuditLog;

  protected readonly jobs: BackgroundJobService;

  protected readonly app: ReturnType<JobRoutes['createApp']>;

  constructor(options: JobRoutesOptions) {
    super();
    this.database = options.database;
    this.guard = options.guard;
    this.courseLoader = options.courseLoader;
    this.auditLog = options.auditLog;
    this.jobs = options.jobs;
    this.app = this.createApp();
  }

  public static create(options: {
    database: DatabaseService;
    guard: AuthGuard;
    auditLog: AuditLog;
    jobs: BackgroundJobService;
  }): JobRoutes {
    return new JobRoutes({
      ...options,
      courseLoader: CourseLoader.create({ database: options.database }),
    });
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

  /** Returns the routes, to mount at {@link JobRoutes.Path}. */
  public getApp(): JobRoutes['app'] {
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
        JobRoutes.validator('query', PageQuerySchema),
        this.courseLoader.middleware(),
        (c) => this.list(c, c.req.valid('query')),
      )
      .get(
        '/:id',
        guard.requirePermission(PermissionEnum.ViewRecords),
        this.courseLoader.middleware(),
        (c) => this.get(c),
      )
      .post(
        '/:id/retry',
        guard.requirePermission(PermissionEnum.IssueCertificates),
        this.courseLoader.middleware(),
        (c) => this.retry(c),
      );
  }

  // newest first, so the panel finds a running job after a reload
  protected list(c: Context<CourseEnv>, page: PageQuery) {
    const course = c.get('course');

    const jobs = this.database
      .getRepositories()
      .jobs.listByCourse(course.id, page);
    return c.json<ApiPage<JobSummary>, 200>(
      { ...jobs, items: jobs.items.map(JobRoutes.toSummary) },
      200,
    );
  }

  protected get(c: Context<CourseEnv>) {
    const job = this.findJob(c);
    if (!job) return this.error(c, ApiErrorCodeEnum.NotFound);

    return c.json<JobSummary, 200>(JobRoutes.toSummary(job), 200);
  }

  // recorded as the job's own action, marked as a retry
  protected retry(c: Context<CourseEnv>) {
    const job = this.findJob(c);
    if (!job) return this.error(c, ApiErrorCodeEnum.NotFound);

    const retried = this.database.getUnitOfWork().transaction(() =>
      this.jobs.retry(job.id).map((retriedJob) => {
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
        return retriedJob;
      }),
    );
    if (retried.isErr()) {
      return this.error(
        c,
        retried.error instanceof ModelNotFoundError
          ? ApiErrorCodeEnum.NotFound
          : ApiErrorCodeEnum.JobNotFailed,
      );
    }

    return c.json<JobSummary, 202>(JobRoutes.toSummary(retried.value), 202);
  }

  // only a job of the course in the path
  protected findJob(c: Context<CourseEnv>): Job | null {
    const id = JobRoutes.parseId(c.req.param('id'));
    if (id === null) return null;

    const job = this.database.getRepositories().jobs.findById(id as JobId);
    return job?.courseId === c.get('course').id ? job : null;
  }
}
