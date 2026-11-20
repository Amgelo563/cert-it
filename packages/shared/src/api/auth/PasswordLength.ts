/** Length limits of an admin panel password. */
export const PasswordLength = {
  min: 10,
  // bounds the hashing cost of a request
  max: 256,
} as const;
