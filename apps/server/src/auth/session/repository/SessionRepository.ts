import type { DuplicateModelError, ModelNotFoundError } from '@cert-it/data';
import type { Result } from 'better-result';
import type { UserId } from '../../../user/User';
import type { Session, SessionId } from '../Session';

/** An object that stores and queries admin panel sessions. */
export interface SessionRepository {
  /** Returns the session with the given token hash, or null if there's none. */
  findByTokenHash(tokenHash: string): Session | null;

  /** Creates a session, unless one already has that token hash. */
  create(data: {
    tokenHash: string;
    userId: UserId;
    expiresAt: Date;
  }): Result<Session, DuplicateModelError>;

  /** Updates the expiration of a session. */
  update(
    id: SessionId,
    data: { expiresAt: Date },
  ): Result<Session, ModelNotFoundError | DuplicateModelError>;

  /** Deletes a session. */
  delete(id: SessionId): Result<void, ModelNotFoundError>;

  /** Deletes every session of the given user, returning how many were deleted. */
  deleteByUser(userId: UserId): number;

  /** Deletes the sessions that expired at or before the given date, returning how many were deleted. */
  deleteExpired(now: Date): number;
}
