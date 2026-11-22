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
  type OutdatedCertificates,
  PermissionEnum,
  type RegenerateCertificatesRequest,
  RegenerateCertificatesRequestSchema,
  type RevokeCertificateRequest,
  RevokeCertificateRequestSchema,
  type UpdateCertificateRequest,
  UpdateCertificateRequestSchema,
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
import type { DataDirectoryService } from '../storage/DataDirectoryService';
import type { TemplateVersion } from '../template/TemplateVersion';
import type { Certificate, CertificateId } from './Certificate';
import { CertificateRegenerator } from './regenerate/CertificateRegenerator';

type CertificateServiceOptions = {
  database: DatabaseService;
  guard: AuthGuard;
  auditLog: AuditLogService;
  jobs: BackgroundJobService;
  /** Where certificate PDFs are, to delete one with its certificate. */
  dataDirectory: DataDirectoryService;
  regenerator: CertificateRegenerator;
  /** @default () => new Date() */
  now?: () => Date;
  /** @default console.error */
  log?: (line: string) => void;
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
    [ApiErrorCodeEnum.NothingToRegenerate]: 409,
  };

  protected readonly database: DatabaseService;

  protected readonly guard: AuthGuard;

  protected readonly auditLog: AuditLogService;

  protected readonly jobs: BackgroundJobService;

  protected readonly dataDirectory: DataDirectoryService;

  protected readonly regenerator: CertificateRegenerator;

  protected readonly now: () => Date;

  protected readonly log: (line: string) => void;

  protected readonly app: ReturnType<CertificateService['createApp']>;

  constructor(options: CertificateServiceOptions) {
    this.database = options.database;
    this.guard = options.guard;
    this.auditLog = options.auditLog;
    this.jobs = options.jobs;
    this.dataDirectory = options.dataDirectory;
    this.regenerator = options.regenerator;
    this.now = options.now ?? (() => new Date());
    this.log = options.log ?? console.error;
    this.app = this.createApp();
  }

  public static create(options: {
    database: DatabaseService;
    guard: AuthGuard;
    auditLog: AuditLogService;
    jobs: BackgroundJobService;
    dataDirectory: DataDirectoryService;
    injections?: Partial<CertificateServiceOptions>;
  }): CertificateService {
    const { injections, ...defaults } = options;
    return new CertificateService({
      regenerator: CertificateRegenerator.create(defaults),
      ...defaults,
      ...injections,
    });
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
      .get(
        '/outdated',
        guard.requirePermission(PermissionEnum.ViewRecords),
        (c) => this.listOutdated(c),
      )
      .post(
        '/regenerate',
        guard.requirePermission(PermissionEnum.IssueCertificates),
        jsonBodyLimit(CertificateService.MaxIssueBytes),
        apiValidator('json', RegenerateCertificatesRequestSchema),
        (c) => this.regenerateOutdated(c, c.req.valid('json')),
      )
      .patch(
        '/:id',
        guard.requirePermission(PermissionEnum.IssueCertificates),
        jsonBodyLimit(),
        apiValidator('json', UpdateCertificateRequestSchema),
        (c) => this.update(c, c.req.valid('json')),
      )
      .delete(
        '/:id',
        guard.requirePermission(PermissionEnum.DeleteRecords),
        (c) => this.remove(c),
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

  protected listOutdated(c: Context<AuthEnv>) {
    const course = this.findCourse(c);
    if (!course) return this.error(c, ApiErrorCodeEnum.NotFound);

    const { templateVersions, participants } = this.database.getRepositories();
    const latest = templateVersions.findLatest(course.id);
    const outdated = latest ? this.findOutdated(course, latest) : [];
    const versions = templateVersions.findVersionNumbers([
      ...new Set(outdated.map((certificate) => certificate.templateVersionId)),
    ]);
    const names = new Map(
      participants
        .findByIds(outdated.map((certificate) => certificate.participantId))
        .map((participant) => [participant.id, participant.name]),
    );

    const items = outdated
      .map((certificate) => ({
        id: certificate.id,
        code: certificate.code,
        participantId: certificate.participantId,
        name: names.get(certificate.participantId) ?? '',
        templateVersion: versions.get(certificate.templateVersionId) ?? 0,
      }))
      .sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id);
    return c.json<OutdatedCertificates, 200>(
      { latestVersion: latest?.version ?? null, items },
      200,
    );
  }

  // moves certificates to the latest version, keeping their codes and dates
  protected regenerateOutdated(
    c: Context<AuthEnv>,
    body: RegenerateCertificatesRequest,
  ) {
    const course = this.findCourse(c);
    if (!course) return this.error(c, ApiErrorCodeEnum.NotFound);

    const latest = this.database
      .getRepositories()
      .templateVersions.findLatest(course.id);
    if (!latest) return this.error(c, ApiErrorCodeEnum.NoTemplate);

    const outdated = this.findOutdated(course, latest);
    const requested = body.certificateIds && new Set(body.certificateIds);
    const selected = requested
      ? outdated.filter((certificate) => requested.has(certificate.id))
      : outdated;
    if (selected.length === 0) {
      return this.error(c, ApiErrorCodeEnum.NothingToRegenerate);
    }

    const job = this.regenerator.queue({
      courseId: course.id,
      certificates: selected,
      version: latest,
      userId: c.get('user').id,
    });
    return c.json<JobSummary, 202>(JobService.toSummary(job), 202);
  }

  // same code and template version; the name lives on the participant
  protected update(c: Context<AuthEnv>, body: UpdateCertificateRequest) {
    const target = this.findCertificate(c);
    if (!target) return this.error(c, ApiErrorCodeEnum.NotFound);

    const repositories = this.database.getRepositories();
    const version = repositories.templateVersions.findById(
      target.templateVersionId,
    );
    if (!version) return this.error(c, ApiErrorCodeEnum.NotFound);

    if (body.name !== undefined) {
      const renamed = repositories.participants.update(target.participantId, {
        name: body.name,
      });
      if (renamed.isErr()) return this.error(c, ApiErrorCodeEnum.NotFound);
    }
    const updated =
      body.issueDate === undefined
        ? target
        : repositories.certificates
            .update(target.id, { issueDate: body.issueDate })
            .unwrapOr(null);
    if (!updated) return this.error(c, ApiErrorCodeEnum.NotFound);

    this.audit(c, updated, AuditActionEnum.Update, {
      code: updated.code,
      ...(body.name === undefined ? {} : { name: body.name }),
      ...(body.issueDate === undefined ? {} : { issueDate: body.issueDate }),
    });
    const job = this.regenerator.queue({
      courseId: updated.courseId,
      certificates: [updated],
      version,
      userId: c.get('user').id,
    });
    return c.json<JobSummary, 202>(JobService.toSummary(job), 202);
  }

  // the row goes first, so the file is never served without one
  protected async remove(c: Context<AuthEnv>) {
    const target = this.findCertificate(c);
    if (!target) return this.error(c, ApiErrorCodeEnum.NotFound);

    const repositories = this.database.getRepositories();
    const deleted = repositories.certificates.delete(target.id);
    if (deleted.isErr()) return this.error(c, ApiErrorCodeEnum.NotFound);

    const path = this.dataDirectory.getCertificatePath(
      target.courseId,
      target.code,
    );
    await this.dataDirectory.deleteFile(path).catch((error: unknown) => {
      this.log(`Couldn't delete ${path}: ${String(error)}`);
    });
    this.audit(c, target, AuditActionEnum.Delete, {
      code: target.code,
      name: repositories.participants.findById(target.participantId)?.name,
    });
    return c.body(null, 204);
  }

  protected findOutdated(
    course: Course,
    latest: TemplateVersion,
  ): Certificate[] {
    return this.database
      .getRepositories()
      .certificates.listWithOtherVersion(course.id, latest.id);
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
    action:
      | typeof AuditActionEnum.Revoke
      | typeof AuditActionEnum.Reinstate
      | typeof AuditActionEnum.Update
      | typeof AuditActionEnum.Delete,
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
