import type { TemplateTextFieldType } from '../../template/TemplateFieldTypeEnum';

/** What an issue or regenerate job reports when it completes. */
export type CertificateJobResult = {
  /** How many certificates the job rendered. */
  readonly rendered: number;
  /** Participants left out because the template's fonts can't draw some of their characters. */
  readonly skipped: readonly {
    readonly participantId: number;
    readonly name: string;
    readonly missing: readonly {
      /** Name of the field in the template. */
      readonly field: string;
      readonly type: TemplateTextFieldType;
      readonly missing: readonly string[];
    }[];
  }[];
};
