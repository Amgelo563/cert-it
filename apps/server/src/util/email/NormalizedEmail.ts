import type { Brand } from '@cert-it/shared';

/** An email trimmed and lowercased, so emails that only differ in case or spacing compare equal. */
export type NormalizedEmail = Brand<string, 'NormalizedEmail'>;

/** Returns the given email trimmed and lowercased. */
export function normalizeEmail(email: string): NormalizedEmail {
  return email.trim().toLowerCase() as NormalizedEmail;
}
