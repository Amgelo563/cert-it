import type { CertificateId } from '../certificate/Certificate';
import type { TemplateVersionId } from '../template/TemplateVersion';

/** The input of a job that renders existing certificates again, keeping their codes. */
export type RegenerateJobPayload = {
  readonly certificateIds: readonly CertificateId[];
  /** The template version to render them with. */
  readonly templateVersionId: TemplateVersionId;
};
