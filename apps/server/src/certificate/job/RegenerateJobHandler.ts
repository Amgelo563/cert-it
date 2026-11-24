import { ModelNotFoundError } from '@cert-it/data';
import type { JobContext } from '@cert-it/jobs';
import { Result } from 'better-result';
import type { Job } from '../../job/Job';
import type { JobTypeEnum } from '@cert-it/shared';
import {
  AbstractCertificateJobHandler,
  type CertificateJobHandlerOptions,
} from './AbstractCertificateJobHandler';
import type { CertificateJobOutput } from './CertificateJobOutput';
import type { SkippedParticipant } from './SkippedParticipant';

type RegenerateJob = Job & { readonly type: typeof JobTypeEnum.Regenerate };

/** Renders existing certificates again with a template version, keeping their codes and issue dates. Safe to run again: each run renders them all again. */
export class RegenerateJobHandler extends AbstractCertificateJobHandler<
  RegenerateJob,
  ModelNotFoundError
> {
  public static create(
    options: CertificateJobHandlerOptions,
  ): RegenerateJobHandler {
    return new RegenerateJobHandler(options);
  }

  public override async run(
    job: RegenerateJob,
    context: JobContext,
  ): Promise<Result<CertificateJobOutput, ModelNotFoundError>> {
    const { courses, templateVersions, participants, certificates } =
      this.database.getRepositories();
    const { certificateIds, templateVersionId } = job.payload;
    const course = courses.findById(job.courseId);
    if (!course) {
      return Result.err(
        new ModelNotFoundError({ model: 'Course', id: job.courseId }),
      );
    }

    const version = templateVersions.findById(templateVersionId);
    if (version?.courseId !== course.id) {
      return Result.err(
        new ModelNotFoundError({
          model: 'TemplateVersion',
          id: templateVersionId,
        }),
      );
    }

    const renderer = await this.loadRenderer(version);
    const skipped: SkippedParticipant[] = [];
    let rendered = 0;
    context.setProgress(0, certificateIds.length);

    for (const [index, id] of certificateIds.entries()) {
      const certificate = certificates.findById(id);
      const participant =
        certificate?.courseId === course.id
          ? participants.findById(certificate.participantId)
          : null;

      // deleted since the job was added
      if (certificate && participant) {
        const skip = await this.renderAndStore(renderer, course, {
          id: certificate.id,
          participant,
          code: certificate.code,
          issueDate: certificate.issueDate,
        });

        if (skip) {
          skipped.push(skip);
        } else {
          rendered += 1;
          if (certificate.templateVersionId !== version.id) {
            certificates.update(id, { templateVersionId: version.id }).unwrap();
          }
        }
      }

      context.setProgress(index + 1);
    }

    return Result.ok({ rendered, skipped });
  }
}
