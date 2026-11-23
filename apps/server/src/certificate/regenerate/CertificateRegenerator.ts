import { AuditActionEnum, AuditEntityEnum, JobTypeEnum } from '@cert-it/shared';
import type { AuditLogService } from '../../audit/AuditLogService';
import type { CourseId } from '../../course/Course';
import type { BackgroundJobService } from '../../job/BackgroundJobService';
import type { Job } from '../../job/Job';
import type { TemplateVersion } from '../../template/TemplateVersion';
import type { UserId } from '../../user/User';
import type { Certificate } from '../Certificate';

type CertificateRegeneratorOptions = {
  auditLog: AuditLogService;
  jobs: BackgroundJobService;
};

/** Adds jobs that render existing certificates again, keeping their codes, and writes each to the audit log. */
export class CertificateRegenerator {
  protected readonly auditLog: AuditLogService;

  protected readonly jobs: BackgroundJobService;

  constructor(options: CertificateRegeneratorOptions) {
    this.auditLog = options.auditLog;
    this.jobs = options.jobs;
  }

  public static create(options: {
    auditLog: AuditLogService;
    jobs: BackgroundJobService;
    injections?: Partial<CertificateRegeneratorOptions>;
  }): CertificateRegenerator {
    const { injections, ...defaults } = options;
    return new CertificateRegenerator({ ...defaults, ...injections });
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
  }
}
