import type { Role } from '../../role/RoleEnum';

/** An admin panel user, as the user management routes return it. */
export type UserSummary = {
  readonly id: number;
  readonly email: string;
  readonly name: string;
  readonly role: Role;
  readonly active: boolean;
  readonly mustChangePassword: boolean;
  /** ISO 8601 date and time. */
  readonly createdAt: string;
};
