export const ApiErrorCodeEnum = {
  /** The body is missing, too large or doesn't match the route's schema. */
  InvalidRequest: 'invalid_request',
  /** No valid session. */
  Unauthorized: 'unauthorized',
  /** The user's role lacks the permission. */
  Forbidden: 'forbidden',
  /** A state-changing request from another origin. */
  CrossOrigin: 'cross_origin',
  /** The user must change their password before anything else. */
  PasswordChangeRequired: 'password_change_required',
  /** Unknown email, wrong password or deactivated account, deliberately alike. */
  InvalidCredentials: 'invalid_credentials',
  TooManyAttempts: 'too_many_attempts',
  /** The current password given to change it is wrong. */
  WrongPassword: 'wrong_password',
  /** The new password is the same as the current one. */
  SamePassword: 'same_password',
  /** No model with the ID in the path. */
  NotFound: 'not_found',
  /** Another user already has the email. */
  EmailTaken: 'email_taken',
  /** Another participant of the course already has the email. */
  ParticipantEmailTaken: 'participant_email_taken',
  /** The change would leave no active Admin. */
  LastAdmin: 'last_admin',
  /** Admins can't change their own role, status or password from user management. */
  OwnAccount: 'own_account',
  /** The uploaded file is over the configured size limit. */
  FileTooLarge: 'file_too_large',
  /** The file is broken or isn't a font. */
  InvalidFont: 'invalid_font',
  /** A .ttc with several fonts in one file. */
  FontCollection: 'font_collection',
  /** A WOFF or WOFF2 web font, where a TTF or OTF is needed. */
  WebFont: 'web_font',
  /** The file is broken or isn't a PDF. */
  InvalidPdf: 'invalid_pdf',
  EncryptedPdf: 'encrypted_pdf',
  /** The PDF doesn't have exactly one page. */
  PdfNotOnePage: 'pdf_not_one_page',
  /** A field names a font that isn't stored. */
  UnknownFont: 'unknown_font',
  /** The base PDF wasn't uploaded to the course. */
  UnknownBasePdf: 'unknown_base_pdf',
  /** The online font catalog didn't answer as expected. */
  CatalogUnavailable: 'catalog_unavailable',
} as const;

/** The code in the body of an API error response. */
export type ApiErrorCode =
  (typeof ApiErrorCodeEnum)[keyof typeof ApiErrorCodeEnum];

/** The body of an API error response. */
export type ApiError = {
  readonly error: ApiErrorCode;
};
