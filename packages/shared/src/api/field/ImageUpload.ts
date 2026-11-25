/** Largest image a field takes. */
export const MaxImageBytes = 2 * 1024 * 1024;

/** The answer to an image upload. */
export type ImageUpload = {
  /** File name of the stored image, <sha256>.<png|jpg>, to give as the field's value. */
  readonly image: string;
};
