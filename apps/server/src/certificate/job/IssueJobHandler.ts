import { ModelNotFoundError } from '@cert-it/data';
import type { JobContext } from '@cert-it/jobs';
import { Result } from 'better-result';
import type { Course } from '../../course/Course';
import type { Job } from '../../job/Job';
import type { JobTypeEnum } from '@cert-it/shared';
import type { Participant } from '../../participant/Participant';
import type { TemplateVersionId } from '../../template/TemplateVersion';
import type { CertificateCode } from '../code/CertificateCode';
import { CertificateCodeGenerator } from '../code/CertificateCodeGenerator';
import type { CertificateRenderer } from '../render/CertificateRenderer';
import {
  AbstractCertificateJobHandler,
  type CertificateJobHandlerOptions,
} from './AbstractCertificateJobHandler';
import type { CertificateJobOutput } from './CertificateJobOutput';
import { NoTemplateError } from './errors/NoTemplateError';
import type { SkippedParticipant } from './SkippedParticipant';

type IssueJob = Job & { readonly type: typeof JobTypeEnum.Issue };

type IssueJobHandlerOptions = CertificateJobHandlerOptions & {
  codes: CertificateCodeGenerator;
};

/** Issues certificates to participants that don't have one, with the course's latest template version. Safe to run again: participants with a certificate are skipped. */
export class IssueJobHandler extends AbstractCertificateJobHandler<
  IssueJob,
  ModelNotFoundError | NoTemplateError
> {
  // codes have 50 random bits, so a few tries always find a free one
  protected static readonly MaxCodeAttempts = 5;

  protected readonly codes: CertificateCodeGenerator;

  constructor(options: IssueJobHandlerOptions) {
    super(options);
    this.codes = options.codes;
  }

  public static create(
    options: CertificateJobHandlerOptions & {
      injections?: Partial<Pick<IssueJobHandlerOptions, 'codes'>>;
    },
  ): IssueJobHandler {
    const { injections, ...shared } = options;

    return new IssueJobHandler({
      ...shared,
      codes: injections?.codes ?? CertificateCodeGenerator.create(),
    });
  }

  public override async run(
    job: IssueJob,
    context: JobContext,
  ): Promise<
    Result<CertificateJobOutput, ModelNotFoundError | NoTemplateError>
  > {
    const { courses, templateVersions, participants, certificates } =
      this.database.getRepositories();
    const course = courses.findById(job.courseId);
    if (!course) {
      return Result.err(
        new ModelNotFoundError({ model: 'Course', id: job.courseId }),
      );
    }

    const version = templateVersions.findLatest(course.id);
    if (!version)
      return Result.err(new NoTemplateError({ courseId: course.id }));

    const renderer = await this.loadRenderer(version);
    const { participantIds, issueDate } = job.payload;
    const skipped: SkippedParticipant[] = [];
    let rendered = 0;
    context.setProgress(0, participantIds.length);

    for (const [index, id] of participantIds.entries()) {
      const participant = participants.findById(id);
      // deleted, moved or already issued, such as on a retry
      if (
        participant?.courseId === course.id
        && !certificates.findByParticipant(id)
      ) {
        const skip = await this.issue(renderer, course, version.id, {
          participant,
          issueDate,
        });
        if (skip) skipped.push(skip);
        else rendered += 1;
      }

      context.setProgress(index + 1);
    }

    return Result.ok({ rendered, skipped });
  }

  // the file goes first, so a crash leaves an unused file rather than a certificate without one; at worst a PDF without its credential
  protected async issue(
    renderer: CertificateRenderer,
    course: Course,
    templateVersionId: TemplateVersionId,
    data: { participant: Participant; issueDate: string },
  ): Promise<SkippedParticipant | null> {
    const code = this.createUnusedCode();
    const skip = await this.renderAndStore(renderer, course, {
      ...data,
      code,
      id: null,
    });
    if (skip) return skip;

    const created = this.database.getRepositories().certificates.create({
      code,
      courseId: course.id,
      participantId: data.participant.id,
      templateVersionId,
      issueDate: data.issueDate,
    });
    if (created.isErr()) {
      await this.dataDirectory.deleteFile(
        this.dataDirectory.getCertificatePath(course.id, code),
      );
      throw created.error;
    }

    // the credential's status entry needs the ID, so it's added once the row exists
    await this.storeCredential(course, {
      ...data,
      code,
      id: created.value.id,
    });
    return null;
  }

  protected createUnusedCode(): CertificateCode {
    const { certificates } = this.database.getRepositories();

    for (let i = 0; i < IssueJobHandler.MaxCodeAttempts; i += 1) {
      const code = this.codes.generate();
      if (!certificates.findByCode(code)) return code;
    }

    throw new Error(
      `No unused certificate code after ${IssueJobHandler.MaxCodeAttempts} tries.`,
    );
  }
}
