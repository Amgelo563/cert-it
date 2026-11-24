import {
  type ApiErrorCode,
  ApiErrorCodeEnum,
  type CertificateSummary,
  type IssueCertificatesRequest,
  IssueCertificatesRequestSchema,
  type JobSummary,
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
import type { AuthGuard } from '../auth/AuthGuard';
import type { DatabaseService } from '../database/DatabaseService';
import { AbstractApiRoutes } from '../http/api/AbstractApiRoutes';
import { JobRoutes } from '../job/JobRoutes';
import type { Certificate, CertificateId } from './Certificate';
import type { CertificateManager } from './CertificateManager';
import type { CourseEnv } from '../course/CourseEnv';
import { CourseLoader } from '../course/CourseLoader';

type CertificateRoutesOptions = {
  database: DatabaseService;
  guard: AuthGuard;
  courseLoader: CourseLoader;
  certificates: CertificateManager;
};

/** Serves a course's certificate routes: Editors issue certificates as background jobs, and revoke or reinstate them. */
export class CertificateRoutes extends AbstractApiRoutes {
  /** Path of the routes, relative to the base path. */
  public static readonly Path = '/api/courses/:courseId/certificates';

  // an issue request lists participant IDs, so it can be as large as an import
  protected static readonly MaxIssueBytes = 256 * 1024;

  protected static override readonly ErrorStatuses: Partial<
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

  protected readonly courseLoader: CourseLoader;

  protected readonly certificates: CertificateManager;

  protected readonly app: ReturnType<CertificateRoutes['createApp']>;

  constructor(options: CertificateRoutesOptions) {
    super();
    this.database = options.database;
    this.guard = options.guard;
    this.courseLoader = options.courseLoader;
    this.certificates = options.certificates;
    this.app = this.createApp();
  }

  public static create(options: {
    database: DatabaseService;
    guard: AuthGuard;
    certificates: CertificateManager;
    injections?: Partial<Pick<CertificateRoutesOptions, 'courseLoader'>>;
  }): CertificateRoutes {
    const { injections, ...shared } = options;

    return new CertificateRoutes({
      ...shared,
      courseLoader:
        injections?.courseLoader
        ?? CourseLoader.create({ database: shared.database }),
    });
  }

  /** Returns the routes, to mount at {@link CertificateRoutes.Path}. */
  public getApp(): CertificateRoutes['app'] {
    return this.app;
  }

  // chained, so hono/client can infer the routes' types
  protected createApp() {
    const { guard } = this;

    return new Hono<CourseEnv>({ strict: false })
      .use(guard.authenticate())
      .post(
        '/issue',
        guard.requirePermission(PermissionEnum.IssueCertificates),
        CertificateRoutes.bodyLimit(CertificateRoutes.MaxIssueBytes),
        CertificateRoutes.validator('json', IssueCertificatesRequestSchema),
        this.courseLoader.middleware(),
        (c) => this.issue(c, c.req.valid('json')),
      )
      .get(
        '/outdated',
        guard.requirePermission(PermissionEnum.ViewRecords),
        this.courseLoader.middleware(),
        (c) => this.listOutdated(c),
      )
      .post(
        '/regenerate',
        guard.requirePermission(PermissionEnum.IssueCertificates),
        CertificateRoutes.bodyLimit(CertificateRoutes.MaxIssueBytes),
        CertificateRoutes.validator(
          'json',
          RegenerateCertificatesRequestSchema,
        ),
        this.courseLoader.middleware(),
        (c) => this.regenerateOutdated(c, c.req.valid('json')),
      )
      .patch(
        '/:id',
        guard.requirePermission(PermissionEnum.IssueCertificates),
        CertificateRoutes.bodyLimit(),
        CertificateRoutes.validator('json', UpdateCertificateRequestSchema),
        this.courseLoader.middleware(),
        (c) => this.update(c, c.req.valid('json')),
      )
      .delete(
        '/:id',
        guard.requirePermission(PermissionEnum.DeleteRecords),
        this.courseLoader.middleware(),
        (c) => this.remove(c),
      )
      .post(
        '/:id/revoke',
        guard.requirePermission(PermissionEnum.RevokeCertificates),
        CertificateRoutes.bodyLimit(),
        CertificateRoutes.validator('json', RevokeCertificateRequestSchema),
        this.courseLoader.middleware(),
        (c) => this.revoke(c, c.req.valid('json')),
      )
      .post(
        '/:id/reinstate',
        guard.requirePermission(PermissionEnum.RevokeCertificates),
        this.courseLoader.middleware(),
        (c) => this.reinstate(c),
      );
  }

  protected issue(c: Context<CourseEnv>, body: IssueCertificatesRequest) {
    const course = c.get('course');

    const job = this.certificates.issue({
      course,
      participantIds: body.participantIds,
      issueDate: body.issueDate,
      userId: c.get('user').id,
    });
    if (job.isErr()) return this.error(c, job.error);
    return c.json<JobSummary, 202>(JobRoutes.toSummary(job.value), 202);
  }

  protected listOutdated(c: Context<CourseEnv>) {
    const course = c.get('course');

    const { templateVersions, participants } = this.database.getRepositories();
    const latest = templateVersions.findLatest(course.id);
    const outdated = latest
      ? this.certificates.listOutdated(course, latest)
      : [];
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

  protected regenerateOutdated(
    c: Context<CourseEnv>,
    body: RegenerateCertificatesRequest,
  ) {
    const course = c.get('course');

    const job = this.certificates.regenerateOutdated({
      course,
      certificateIds: body.certificateIds,
      userId: c.get('user').id,
    });
    if (job.isErr()) return this.error(c, job.error);
    return c.json<JobSummary, 202>(JobRoutes.toSummary(job.value), 202);
  }

  protected update(c: Context<CourseEnv>, body: UpdateCertificateRequest) {
    const certificate = this.findCertificate(c);
    if (!certificate) return this.error(c, ApiErrorCodeEnum.NotFound);

    const job = this.certificates.update({
      certificate,
      name: body.name,
      issueDate: body.issueDate,
      userId: c.get('user').id,
    });
    if (job.isErr()) return this.error(c, job.error);
    return c.json<JobSummary, 202>(JobRoutes.toSummary(job.value), 202);
  }

  protected async remove(c: Context<CourseEnv>) {
    const certificate = this.findCertificate(c);
    if (!certificate) return this.error(c, ApiErrorCodeEnum.NotFound);

    const removed = await this.certificates.remove(
      certificate,
      c.get('user').id,
    );
    if (removed.isErr()) return this.error(c, removed.error);
    return c.body(null, 204);
  }

  protected revoke(c: Context<CourseEnv>, body: RevokeCertificateRequest) {
    const certificate = this.findCertificate(c);
    if (!certificate) return this.error(c, ApiErrorCodeEnum.NotFound);

    const revoked = this.certificates.revoke({
      certificate,
      reason: body.reason,
      userId: c.get('user').id,
    });
    if (revoked.isErr()) return this.error(c, revoked.error);
    return c.json<CertificateSummary, 200>(this.toSummary(revoked.value), 200);
  }

  protected reinstate(c: Context<CourseEnv>) {
    const certificate = this.findCertificate(c);
    if (!certificate) return this.error(c, ApiErrorCodeEnum.NotFound);

    const reinstated = this.certificates.reinstate(
      certificate,
      c.get('user').id,
    );
    if (reinstated.isErr()) return this.error(c, reinstated.error);
    return c.json<CertificateSummary, 200>(
      this.toSummary(reinstated.value),
      200,
    );
  }

  // only a certificate of the course in the path
  protected findCertificate(c: Context<CourseEnv>): Certificate | null {
    const id = CertificateRoutes.parseId(c.req.param('id'));
    if (id === null) return null;

    const certificate = this.database
      .getRepositories()
      .certificates.findById(id as CertificateId);
    return certificate?.courseId === c.get('course').id ? certificate : null;
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
}
