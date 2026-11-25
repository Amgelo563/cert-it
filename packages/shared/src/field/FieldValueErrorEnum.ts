/** What's wrong with a value given for a course field. */
export const FieldValueErrorEnum = {
  /** The field is required and has no value. */
  Required: 'required',
  /** Text longer than a text field takes. */
  TooLong: 'too_long',
  InvalidNumber: 'invalid_number',
  InvalidDate: 'invalid_date',
  InvalidBoolean: 'invalid_boolean',
  /** No image file with that name was given. */
  ImageNotFound: 'image_not_found',
  /** Several image files have that name. */
  ImageAmbiguous: 'image_ambiguous',
  /** The file isn't a PNG or JPEG image. */
  ImageInvalid: 'image_invalid',
  ImageTooLarge: 'image_too_large',
  /** The image isn't stored on the server. */
  ImageNotUploaded: 'image_not_uploaded',
} as const;

/** What's wrong with a value given for a course field. */
export type FieldValueError =
  (typeof FieldValueErrorEnum)[keyof typeof FieldValueErrorEnum];
