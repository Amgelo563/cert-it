import type { Brand, Role } from '@cert-it/shared';
import type { NormalizedEmail } from '../util/email/NormalizedEmail';

export type UserId = Brand<number, 'UserId'>;

/** An account that can log in to the admin panel. */
export type User = {
  readonly id: UserId;
  readonly email: NormalizedEmail;
  /** Name shown to identify the user in the panel. */
  readonly name: string;
  readonly role: Role;
  /** Whether the user can log in, false once an admin deactivates them. */
  readonly active: boolean;
  /** Whether the user must change their password on their next login. */
  readonly mustChangePassword: boolean;
  readonly createdAt: Date;
};
