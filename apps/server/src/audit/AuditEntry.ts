import type { Brand } from '@cert-it/shared';
import type { UserId } from '../user/User';
import type { AuditAction } from './AuditActionEnum';
import type { AuditEntity } from './AuditEntityEnum';

export type AuditEntryId = Brand<number, 'AuditEntryId'>;

/** A change recorded in the audit log. */
export type AuditEntry = {
  readonly id: AuditEntryId;
  /** The user who made the change, or null if the app made it on its own (such as creating the first Admin). */
  readonly userId: UserId | null;
  readonly action: AuditAction;
  readonly entity: AuditEntity;
  /** ID of the changed model, which may no longer exist. */
  readonly entityId: number;
  /** Extra data about the change, such as the changed fields or a revocation reason. */
  readonly details: Readonly<Record<string, unknown>>;
  readonly createdAt: Date;
};
