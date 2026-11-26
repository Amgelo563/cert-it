import type { Role } from '../../role/RoleEnum';

/** The logged-in user, as the auth routes return it. */
export type CurrentUser = {
  readonly id: number;
  readonly email: string;
  readonly name: string;
  readonly role: Role;
  /** Whether every other route is blocked until the password is changed. */
  readonly mustChangePassword: boolean;
};
