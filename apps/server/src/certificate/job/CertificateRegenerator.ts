import { AuditActionEnum, AuditEntityEnum, JobTypeEnum } from '@cert-it/shared';
import type { AuditLog } from '../../audit/AuditLog';
import type { CourseId } from '../../course/Course';
import type { DatabaseService } from '../../database/DatabaseService';
import type { BackgroundJobService } from '../../job/BackgroundJobService';
import type { Job } from '../../job/Job';
import type { TemplateVersion } from '../../template/TemplateVersion';
import type { UserId } from '../../user/User';
import type { Certificate } from '../Certificate';

type CertificateRegeneratorOptions = {
  database: DatabaseService;
  auditLog: AuditLog;
  jobs: BackgroundJobService;
};

/** Adds jobs that render existing certificates again, keeping their codes, and writes each to the audit log. */
export class CertificateRegenerator {
  protected readonly database: DatabaseService;

  protected readonly auditLog: AuditLog;

  protected readonly jobs: BackgroundJobService;

  constructor(options: CertificateRegeneratorOptions) {
    this.database = options.database;
    this.auditLog = options.auditLog;
    this.jobs = options.jobs;
  }

  public static create(options: {
    database: DatabaseService;
    auditLog: AuditLog;
    jobs: BackgroundJobService;
  }): CertificateRegenerator {
    return new CertificateRegenerator(options);
  }

  /**
   * Adds a job that renders the certificates of a course with a template version.
   *
   * @param certificates At least one, all of the course.
   */
  public queue(options: {
    courseId: CourseId;
    certificates: readonly Certificate[];
    version: TemplateVersion;
    /** Null when the app regenerates on its own. */
    userId: UserId | null;
  }): Job {
    const { courseId, certificates, version, userId } = options;

    return this.database.atomically(() => {
      const job = this.jobs
        .add({
          type: JobTypeEnum.Regenerate,
          payload: {
            certificateIds: certificates.map(({ id }) => id),
            templateVersionId: version.id,
          },
          courseId,
          total: certificates.length,
          createdBy: userId,
        })
        .unwrap();
      this.auditLog.record({
        userId,
        action: AuditActionEnum.Regenerate,
        entity: AuditEntityEnum.Job,
        entityId: job.id,
        details: {
          courseId,
          certificates: certificates.length,
          templateVersion: version.version,
        },
      });
      return job;
    });
  }

  /**
   * Adds one job per course and template version, so each certificate keeps its version and code.
   *
   * @param userId Null when the app regenerates on its own.
   * @returns The jobs added, none if there are no certificates.
   */
  public queueAll(
    certificates: readonly Certificate[],
    userId: UserId | null,
  ): Job[] {
    const groups = new Map<string, Certificate[]>();
    for (const certificate of certificates) {
      const key = `${certificate.courseId}:${certificate.templateVersionId}`;
      groups.set(key, [...(groups.get(key) ?? []), certificate]);
    }

    // all the jobs or none
    return this.database.atomically(() => {
      const { templateVersions } = this.database.getRepositories();
      const jobs: Job[] = [];
      for (const group of groups.values()) {
        const [first] = group;
        const version =
          first && templateVersions.findById(first.templateVersionId);
        if (!first || !version) continue;

        jobs.push(
          this.queue({
            courseId: first.courseId,
            certificates: group,
            version,
            userId,
          }),
        );
      }
      return jobs;
    });
  }
}
