/** Size above which the editor is warned that every certificate carries a full copy of the base PDF. */
export const LargeBasePdfBytes = 1024 * 1024;

/** The answer to a base PDF upload. */
export type BasePdfUpload = {
  /** SHA-256 of the file, to send when saving the template. */
  readonly basePdf: string;
  readonly bytes: number;
  /** Whether it's above {@link LargeBasePdfBytes}. */
  readonly large: boolean;
};
