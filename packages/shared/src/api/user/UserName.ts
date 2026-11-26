import { string } from 'zod';

/** Longest name a user can have. */
export const UserNameMaxLength = 100;

/** Name of an admin panel user, trimmed and never empty. */
export const UserName = string().trim().min(1).max(UserNameMaxLength);
