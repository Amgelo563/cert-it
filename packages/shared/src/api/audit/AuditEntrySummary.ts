import type { AuditAction } from '../../audit/AuditActionEnum';
import type { AuditEntity } from '../../audit/AuditEntityEnum';

/** An audit log entry, as the audit log route returns it. */
export type AuditEntrySummary = {
  readonly id: number;
  /** The user who made the change, or null if the app made it on its own. */
  readonly userId: number | null;
  readonly action: AuditAction;
  readonly entity: AuditEntity;
  /** ID of the changed model, which may no longer exist. */
  readonly entityId: number;
  readonly details: Readonly<Record<string, unknown>>;
  /** ISO 8601 date and time. */
  readonly createdAt: string;
};
