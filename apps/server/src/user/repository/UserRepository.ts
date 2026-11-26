import type {
  DuplicateModelError,
  ModelNotFoundError,
  Page,
  PageRequest,
} from '@cert-it/data';
import type { Role } from '@cert-it/shared';
import type { Result } from 'better-result';
import type { NormalizedEmail } from '../../util/email/NormalizedEmail';
import type { User, UserId } from '../User';

/** An object that stores and queries admin panel users. */
export interface UserRepository {
  /** Returns the user with the given ID, or null if there's none. */
  findById(id: UserId): User | null;

  /** Returns the user with the given email, or null if there's none. */
  findByEmail(email: NormalizedEmail): User | null;

  /** Returns the password hash of the given user, or null if there's no such user. */
  findPasswordHash(id: UserId): string | null;

  /** Creates a user, unless one already has that email. */
  create(data: {
    email: NormalizedEmail;
    name: string;
    passwordHash: string;
    role: Role;
    mustChangePassword?: boolean;
  }): Result<User, DuplicateModelError>;

  /** Updates the given fields of a user. */
  update(
    id: UserId,
    data: {
      email?: NormalizedEmail;
      name?: string;
      passwordHash?: string;
      role?: Role;
      active?: boolean;
      mustChangePassword?: boolean;
    },
  ): Result<User, ModelNotFoundError | DuplicateModelError>;

  /** Returns a page of users, sorted by email. */
  list(page: PageRequest): Page<User>;

  /** Gives the given name to users without one, returning how many changed. */
  fillMissingNames(name: string): number;

  /** Returns the number of users, active or not. */
  count(): number;

  /** Returns the number of active users with the Admin role. */
  countActiveAdmins(): number;
}
