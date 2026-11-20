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
} as const;

/** The code in the body of an API error response. */
export type ApiErrorCode =
  (typeof ApiErrorCodeEnum)[keyof typeof ApiErrorCodeEnum];

/** The body of an API error response. */
export type ApiError = {
  readonly error: ApiErrorCode;
};
