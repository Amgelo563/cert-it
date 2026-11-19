import type { Brand } from '@cert-it/shared';
import type { UserId } from '../../user/User';

export type SessionId = Brand<number, 'SessionId'>;

/** A logged-in admin panel session, found by the hash of its cookie token. */
export type Session = {
  readonly id: SessionId;
  /** Hash of the token in the session cookie, which itself is never stored. */
  readonly tokenHash: string;
  readonly userId: UserId;
  readonly expiresAt: Date;
  readonly createdAt: Date;
};
