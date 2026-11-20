import { type output, strictObject, string } from 'zod';
import { PasswordLength } from './PasswordLength';

// no format or minimum checks, so a failed login says nothing about the rules
export const LoginRequestSchema = strictObject({
  email: string().trim().min(1).max(254),
  password: string().min(1).max(PasswordLength.max),
});

/** The body of a login request. */
export type LoginRequest = output<typeof LoginRequestSchema>;
