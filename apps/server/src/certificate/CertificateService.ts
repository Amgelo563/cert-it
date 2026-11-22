import {
  type ApiErrorCode,
  ApiErrorCodeEnum,
  AuditActionEnum,
  AuditEntityEnum,
  type CertificateSummary,
  CertificateStatusEnum,
  type IssueCertificatesRequest,
  IssueCertificatesRequestSchema,
  type JobSummary,
  JobTypeEnum,
  PermissionEnum,
  type RevokeCertificateRequest,
  RevokeCertificateRequestSchema,
} from '@cert-it/shared';
import { type Context, Hono } from 'hono';
import type { ClientErrorStatusCode } from 'hono/utils/http-status';
import type { AuditLogService } from '../audit/AuditLogService';
import type { AuthEnv } from '../auth/AuthEnv';
import type { AuthGuard } from '../auth/AuthGuard';
import type { Course, CourseId } from '../course/Course';
import type { DatabaseService } from '../database/DatabaseService';
import { apiError } from '../http/api/apiError';
import { apiValidator } from '../http/api/apiValidator';
import { jsonBodyLimit } from '../http/api/jsonBodyLimit';
import type { BackgroundJobService } from '../job/BackgroundJobService';
import { JobService } from '../job/JobService';
import type { ParticipantId } from '../participant/Participant';
import type { Certificate, CertificateId } from './Certificate';

type CertificateServiceOptions = {
  database: DatabaseService;
  guard: AuthGuard;
  auditLog: AuditLogService;
  jobs: BackgroundJobService;
  /** @default () => new Date() */
  now?: () => Date;
};

/** Serves a course's certificate routes: Editors issue certificates as background jobs, and revoke or reinstate them. */
export class CertificateService {
  /** Path of the routes, relative to the base path. */
  public static readonly Path = '/api/courses/:courseId/certificates';

  // an issue request lists participant IDs, so it can be as large as an import
  protected static readonly MaxIssueBytes = 256 * 1024;

  protected static readonly ErrorStatuses: Partial<
    Record<ApiErrorCode, ClientErrorStatusCode>
  > = {
    [ApiErrorCodeEnum.NotFound]: 404,
    [ApiErrorCodeEnum.NoTemplate]: 409,
    [ApiErrorCodeEnum.NothingToIssue]: 409,
    [ApiErrorCodeEnum.CertificateRevoked]: 409,
    [ApiErrorCodeEnum.CertificateActive]: 409,
  };

  protected readonly database: DatabaseService;

  protected readonly guard: AuthGuard;

  protected readonly auditLog: AuditLogService;

  protected readonly jobs: BackgroundJobService;

  protected readonly now: () => Date;

  protected readonly app: ReturnType<CertificateService['createApp']>;

  constructor(options: CertificateServiceOptions) {
    this.database = options.database;
    this.guard = options.guard;
    this.auditLog = options.auditLog;
    this.jobs = options.jobs;
    this.now = options.now ?? (() => new Date());
    this.app = this.createApp();
  }

  public static create(options: {
    database: DatabaseService;
    guard: AuthGuard;
    auditLog: AuditLogService;
    jobs: BackgroundJobService;
    injections?: Partial<CertificateServiceOptions>;
  }): CertificateService {
    const { injections, ...defaults } = options;
    return new CertificateService({ ...defaults, ...injections });
  }

  /** Returns the routes, to mount at {@link CertificateService.Path}. */
  public getApp(): CertificateService['app'] {
    return this.app;
  }

  // chained, so hono/client can infer the routes' types
  protected createApp() {
    const { guard } = this;

    return new Hono<AuthEnv>({ strict: false })
      .use(guard.authenticate())
      .post(
        '/issue',
        guard.requirePermission(PermissionEnum.IssueCertificates),
        jsonBodyLimit(CertificateService.MaxIssueBytes),
        apiValidator('json', IssueCertificatesRequestSchema),
        (c) => this.issue(c, c.req.valid('json')),
      )
      .post(
        '/:id/revoke',
        guard.requirePermission(PermissionEnum.RevokeCertificates),
        jsonBodyLimit(),
        apiValidator('json', RevokeCertificateRequestSchema),
        (c) => this.revoke(c, c.req.valid('json')),
      )
      .post(
        '/:id/reinstate',
        guard.requirePermission(PermissionEnum.RevokeCertificates),
        (c) => this.reinstate(c),
      );
  }

  // the job uses the latest template when it runs; this only checks there is one
  protected issue(c: Context<AuthEnv>, body: IssueCertificatesRequest) {
    const course = this.findCourse(c);
    if (!course) return this.error(c, ApiErrorCodeEnum.NotFound);

    const { templateVersions } = this.database.getRepositories();
    if (!templateVersions.findLatest(course.id)) {
      return this.error(c, ApiErrorCodeEnum.NoTemplate);
    }

    const participantIds = this.listToIssue(course, body.participantIds);
    if (participantIds.length === 0) {
      return this.error(c, ApiErrorCodeEnum.NothingToIssue);
    }

    const issueDate = body.issueDate ?? this.today();
    const job = this.jobs
      .add({
        type: JobTypeEnum.Issue,
        payload: { participantIds, issueDate },
        courseId: course.id,
        total: participantIds.length,
        createdBy: c.get('user').id,
      })
      .unwrap();
    this.auditLog.record({
      userId: c.get('user').id,
      action: AuditActionEnum.Issue,
      entity: AuditEntityEnum.Job,
      entityId: job.id,
      details: {
        courseId: course.id,
        participants: participantIds.length,
        issueDate,
      },
    });
    return c.json<JobSummary, 202>(JobService.toSummary(job), 202);
  }

  protected revoke(c: Context<AuthEnv>, body: RevokeCertificateRequest) {
    const target = this.findCertificate(c);
    if (!target) return this.error(c, ApiErrorCodeEnum.NotFound);
    if (target.status === CertificateStatusEnum.Revoked) {
      return this.error(c, ApiErrorCodeEnum.CertificateRevoked);
    }

    const revoked = this.database
      .getRepositories()
      .certificates.update(target.id, {
        status: CertificateStatusEnum.Revoked,
        revokedAt: this.now(),
        revokedReason: body.reason,
      });
    if (revoked.isErr()) return this.error(c, ApiErrorCodeEnum.NotFound);

    this.audit(c, revoked.value, AuditActionEnum.Revoke, {
      code: target.code,
      reason: body.reason,
    });
    return c.json<CertificateSummary, 200>(this.toSummary(revoked.value), 200);
  }

  protected reinstate(c: Context<AuthEnv>) {
    const target = this.findCertificate(c);
    if (!target) return this.error(c, ApiErrorCodeEnum.NotFound);
    if (target.status === CertificateStatusEnum.Active) {
      return this.error(c, ApiErrorCodeEnum.CertificateActive);
    }

    const reinstated = this.database
      .getRepositories()
      .certificates.update(target.id, {
        status: CertificateStatusEnum.Active,
        revokedAt: null,
        revokedReason: null,
      });
    if (reinstated.isErr()) return this.error(c, ApiErrorCodeEnum.NotFound);

    this.audit(c, reinstated.value, AuditActionEnum.Reinstate, {
      code: target.code,
    });
    return c.json<CertificateSummary, 200>(
      this.toSummary(reinstated.value),
      200,
    );
  }

  // participants of the course without a certificate, in the order given
  protected listToIssue(
    course: Course,
    requested: readonly number[] | undefined,
  ): ParticipantId[] {
    const { participants, certificates } = this.database.getRepositories();
    if (!requested) {
      return participants.listWithoutCertificate(course.id).map(({ id }) => id);
    }

    const ids = [...new Set(requested)] as ParticipantId[];
    const inCourse = new Set(
      participants
        .findByIds(ids)
        .filter((participant) => participant.courseId === course.id)
        .map(({ id }) => id),
    );
    const issued = new Set(
      certificates.listByParticipants(ids).map((c) => c.participantId),
    );
    return ids.filter((id) => inCourse.has(id) && !issued.has(id));
  }

  // the server's own calendar day
  protected today(): string {
    const now = this.now();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  }

  protected findCourse(c: Context<AuthEnv>): Course | null {
    const id = CertificateService.parseId(c.req.param('courseId'));
    if (id === null) return null;
    return this.database.getRepositories().courses.findById(id as CourseId);
  }

  // only a certificate of the course in the path
  protected findCertificate(c: Context<AuthEnv>): Certificate | null {
    const courseId = CertificateService.parseId(c.req.param('courseId'));
    const id = CertificateService.parseId(c.req.param('id'));
    if (courseId === null || id === null) return null;

    const certificate = this.database
      .getRepositories()
      .certificates.findById(id as CertificateId);
    return certificate?.courseId === courseId ? certificate : null;
  }

  protected audit(
    c: Context<AuthEnv>,
    target: Certificate,
    action: typeof AuditActionEnum.Revoke | typeof AuditActionEnum.Reinstate,
    details: Readonly<Record<string, unknown>>,
  ): void {
    this.auditLog.record({
      userId: c.get('user').id,
      action,
      entity: AuditEntityEnum.Certificate,
      entityId: target.id,
      details,
    });
  }

  protected toSummary(certificate: Certificate): CertificateSummary {
    const versions = this.database
      .getRepositories()
      .templateVersions.findVersionNumbers([certificate.templateVersionId]);

    return {
      id: certificate.id,
      code: certificate.code,
      participantId: certificate.participantId,
      status: certificate.status,
      templateVersion: versions.get(certificate.templateVersionId) ?? 0,
      issueDate: certificate.issueDate,
      revokedAt: certificate.revokedAt?.toISOString() ?? null,
      revokedReason: certificate.revokedReason,
    };
  }

  protected error(c: Context<AuthEnv>, code: ApiErrorCode) {
    return apiError(c, CertificateService.ErrorStatuses[code] ?? 400, code);
  }

  protected static parseId(value: string | undefined): number | null {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  }
}
