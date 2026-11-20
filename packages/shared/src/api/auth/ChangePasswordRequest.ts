import { type output, strictObject, string } from 'zod';
import { PasswordLength } from './PasswordLength';

export const ChangePasswordRequestSchema = strictObject({
  currentPassword: string().min(1).max(PasswordLength.max),
  newPassword: string().min(PasswordLength.min).max(PasswordLength.max),
});

/** The body of a request to change the logged-in user's password. */
export type ChangePasswordRequest = output<typeof ChangePasswordRequestSchema>;
