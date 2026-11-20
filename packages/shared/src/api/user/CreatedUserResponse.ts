import type { UserSummary } from './UserSummary';

/** A new user with the random password to hand over, shown only once. */
export type CreatedUserResponse = {
  readonly user: UserSummary;
  readonly password: string;
};
