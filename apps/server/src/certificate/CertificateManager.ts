import {
  type ApiErrorCode,
  ApiErrorCodeEnum,
  type AuditAction,
  AuditActionEnum,
  AuditEntityEnum,
  CertificateStatusEnum,
  JobTypeEnum,
} from '@cert-it/shared';
import { Result } from 'better-result';
import type { AuditLog } from '../audit/AuditLog';
import type { Course } from '../course/Course';
import type { DatabaseService } from '../database/DatabaseService';
import type { BackgroundJobService } from '../job/BackgroundJobService';
import type { Job } from '../job/Job';
import type { ParticipantId } from '../participant/Participant';
import type { DataDirectoryService } from '../storage/DataDirectoryService';
import type { TemplateVersion } from '../template/TemplateVersion';
import type { UserId } from '../user/User';
import type { Certificate } from './Certificate';
import { CertificateRegenerator } from './job/CertificateRegenerator';
import type { Clock } from '../clock/Clock';
import { SystemClock } from '../clock/SystemClock';
import { ConsoleLogger } from '../log/ConsoleLogger';
import type { Logger } from '../log/Logger';

type CertificateManagerOptions = {
  database: DatabaseService;
  auditLog: AuditLog;
  jobs: BackgroundJobService;
  /** Where certificate PDFs are, to delete one with its certificate. */
  dataDirectory: DataDirectoryService;
  regenerator: CertificateRegenerator;
  clock: Clock;
  logger: Logger;
};

/** Issues, regenerates, edits, revokes and deletes certificates, writing each change to the audit log. */
export class CertificateManager {
  protected readonly database: DatabaseService;

  protected readonly auditLog: AuditLog;

  protected readonly jobs: BackgroundJobService;

  protected readonly dataDirectory: DataDirectoryService;

  protected readonly regenerator: CertificateRegenerator;

  protected readonly clock: Clock;

  protected readonly logger: Logger;

  constructor(options: CertificateManagerOptions) {
    this.database = options.database;
    this.auditLog = options.auditLog;
    this.jobs = options.jobs;
    this.dataDirectory = options.dataDirectory;
    this.regenerator = options.regenerator;
    this.clock = options.clock;
    this.logger = options.logger;
  }

  public static create(options: {
    database: DatabaseService;
    auditLog: AuditLog;
    jobs: BackgroundJobService;
    dataDirectory: DataDirectoryService;
    injections?: Partial<
      Pick<CertificateManagerOptions, 'regenerator' | 'clock' | 'logger'>
    >;
  }): CertificateManager {
    const { injections, ...defaults } = options;

    return new CertificateManager({
      ...defaults,
      regenerator:
        injections?.regenerator ?? CertificateRegenerator.create(defaults),
      clock: injections?.clock ?? SystemClock.Instance,
      logger: injections?.logger ?? ConsoleLogger.Instance,
    });
  }

  /**
   * Adds a job that issues certificates to participants of the course without one. The job uses the latest template when it runs; this only checks there is one.
   *
   * @param participantIds The participants to issue to, or every one without a certificate.
   */
  public issue(options: {
    course: Course;
    participantIds?: readonly number[];
    /** @default today, in the server's calendar */
    issueDate?: string;
    userId: UserId;
  }): Result<Job, ApiErrorCode> {
    const { course, userId } = options;
    const { templateVersions } = this.database.getRepositories();
    if (!templateVersions.findLatest(course.id)) {
      return Result.err(ApiErrorCodeEnum.NoTemplate);
    }

    const participantIds = this.listToIssue(course, options.participantIds);
    if (participantIds.length === 0) {
      return Result.err(ApiErrorCodeEnum.NothingToIssue);
    }

    const issueDate = options.issueDate ?? this.today();
    return Result.ok(
      this.database.atomically(() => {
        const job = this.jobs
          .add({
            type: JobTypeEnum.Issue,
            payload: { participantIds, issueDate },
            courseId: course.id,
            total: participantIds.length,
            createdBy: userId,
          })
          .unwrap();
        this.auditLog.record({
          userId,
          action: AuditActionEnum.Issue,
          entity: AuditEntityEnum.Job,
          entityId: job.id,
          details: {
            courseId: course.id,
            participants: participantIds.length,
            issueDate,
          },
        });
        return job;
      }),
    );
  }

  /** Returns the certificates of the course rendered with another version than the given one. */
  public listOutdated(course: Course, latest: TemplateVersion): Certificate[] {
    return this.database
      .getRepositories()
      .certificates.listWithOtherVersion(course.id, latest.id);
  }

  /**
   * Adds a job that moves certificates to the latest template version, keeping their codes and dates.
   *
   * @param certificateIds The outdated certificates to move, or all of them.
   */
  public regenerateOutdated(options: {
    course: Course;
    certificateIds?: readonly number[];
    userId: UserId;
  }): Result<Job, ApiErrorCode> {
    const { course, certificateIds, userId } = options;
    const latest = this.database
      .getRepositories()
      .templateVersions.findLatest(course.id);
    if (!latest) return Result.err(ApiErrorCodeEnum.NoTemplate);

    const outdated = this.listOutdated(course, latest);
    const requested = certificateIds && new Set(certificateIds);
    const selected = requested
      ? outdated.filter((certificate) => requested.has(certificate.id))
      : outdated;
    if (selected.length === 0) {
      return Result.err(ApiErrorCodeEnum.NothingToRegenerate);
    }

    return Result.ok(
      this.regenerator.queue({
        courseId: course.id,
        certificates: selected,
        version: latest,
        userId,
      }),
    );
  }

  /** Changes the participant's name or the issue date, and adds a job that renders the certificate again with the same code and template version. */
  public update(options: {
    certificate: Certificate;
    name?: string;
    issueDate?: string;
    userId: UserId;
  }): Result<Job, ApiErrorCode> {
    const { certificate, name, issueDate, userId } = options;

    // an error after the rename rolls it back
    return this.database
      .getUnitOfWork()
      .transaction((repositories): Result<Job, ApiErrorCode> => {
        const version = repositories.templateVersions.findById(
          certificate.templateVersionId,
        );
        if (!version) return Result.err(ApiErrorCodeEnum.NotFound);

        // the name lives on the participant
        if (name !== undefined) {
          const renamed = repositories.participants.update(
            certificate.participantId,
            { name },
          );
          if (renamed.isErr()) return Result.err(ApiErrorCodeEnum.NotFound);
        }
        const updated =
          issueDate === undefined
            ? certificate
            : repositories.certificates
                .update(certificate.id, { issueDate })
                .unwrapOr(null);
        if (!updated) return Result.err(ApiErrorCodeEnum.NotFound);

        this.audit(userId, updated, AuditActionEnum.Update, {
          code: updated.code,
          ...(name === undefined ? {} : { name }),
          ...(issueDate === undefined ? {} : { issueDate }),
        });
        return Result.ok(
          this.regenerator.queue({
            courseId: updated.courseId,
            certificates: [updated],
            version,
            userId,
          }),
        );
      });
  }

  /** Deletes a certificate and its PDF. The row goes first, so the file is never served without one. */
  public async remove(
    certificate: Certificate,
    userId: UserId,
  ): Promise<Result<void, ApiErrorCode>> {
    const deleted = this.database
      .getUnitOfWork()
      .transaction((repositories): Result<void, ApiErrorCode> => {
        const removed = repositories.certificates.delete(certificate.id);
        if (removed.isErr()) return Result.err(ApiErrorCodeEnum.NotFound);

        this.audit(userId, certificate, AuditActionEnum.Delete, {
          code: certificate.code,
          name: repositories.participants.findById(certificate.participantId)
            ?.name,
        });
        return Result.ok(undefined);
      });
    if (deleted.isErr()) return deleted;

    // after the commit, so a rollback never leaves a row without its file
    await this.deleteFile(certificate);
    return deleted;
  }

  /** Revokes an active certificate with the given reason. */
  public revoke(options: {
    certificate: Certificate;
    reason: string;
    userId: UserId;
  }): Result<Certificate, ApiErrorCode> {
    const { certificate, reason, userId } = options;
    if (certificate.status === CertificateStatusEnum.Revoked) {
      return Result.err(ApiErrorCodeEnum.CertificateRevoked);
    }

    return this.database
      .getUnitOfWork()
      .transaction(({ certificates }): Result<Certificate, ApiErrorCode> => {
        const revoked = certificates.update(certificate.id, {
          status: CertificateStatusEnum.Revoked,
          revokedAt: this.clock.now(),
          revokedReason: reason,
        });
        if (revoked.isErr()) return Result.err(ApiErrorCodeEnum.NotFound);

        this.audit(userId, revoked.value, AuditActionEnum.Revoke, {
          code: certificate.code,
          reason,
        });
        return Result.ok(revoked.value);
      });
  }

  /** Makes a revoked certificate active again. */
  public reinstate(
    certificate: Certificate,
    userId: UserId,
  ): Result<Certificate, ApiErrorCode> {
    if (certificate.status === CertificateStatusEnum.Active) {
      return Result.err(ApiErrorCodeEnum.CertificateActive);
    }

    return this.database
      .getUnitOfWork()
      .transaction(({ certificates }): Result<Certificate, ApiErrorCode> => {
        const reinstated = certificates.update(certificate.id, {
          status: CertificateStatusEnum.Active,
          revokedAt: null,
          revokedReason: null,
        });
        if (reinstated.isErr()) return Result.err(ApiErrorCodeEnum.NotFound);

        this.audit(userId, reinstated.value, AuditActionEnum.Reinstate, {
          code: certificate.code,
        });
        return Result.ok(reinstated.value);
      });
  }

  /** Deletes a certificate's PDF, logging instead of failing if it can't. */
  public async deleteFile(certificate: Certificate): Promise<void> {
    const path = this.dataDirectory.getCertificatePath(
      certificate.courseId,
      certificate.code,
    );
    await this.dataDirectory.deleteFile(path).catch((error: unknown) => {
      this.logger.error(`Couldn't delete ${path}: ${String(error)}`);
    });
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
    const now = this.clock.now();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  }

  protected audit(
    userId: UserId,
    target: Certificate,
    action: AuditAction,
    details: Readonly<Record<string, unknown>>,
  ): void {
    this.auditLog.record({
      userId,
      action,
      entity: AuditEntityEnum.Certificate,
      entityId: target.id,
      details,
    });
  }
}
