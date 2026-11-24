import type { UserId } from '../user/User';
import type { AuditRecord, Brand } from '@cert-it/shared';

export type AuditEntryId = Brand<number, 'AuditEntryId'>;

/** A change recorded in the audit log. */
export type AuditEntry = AuditRecord & {
  readonly id: AuditEntryId;
  /** The user who made the change, or null if the app made it on its own (such as creating the first Admin). */
  readonly userId: UserId | null;
  /** ID of the changed model, which may no longer exist. */
  readonly entityId: number;
  readonly createdAt: Date;
};
