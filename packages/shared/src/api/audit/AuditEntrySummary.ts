import type { AuditAction } from '../../audit/AuditActionEnum';
import type { AuditEntity } from '../../audit/AuditEntityEnum';

/** An audit log entry, as the audit log route returns it. */
export type AuditEntrySummary = {
  readonly id: number;
  /** The user who made the change, or null if the app made it on its own. */
  readonly userId: number | null;
  /** Email of that user, or null if the app made the change or the user no longer exists. */
  readonly userEmail: string | null;
  readonly action: AuditAction;
  readonly entity: AuditEntity;
  /** ID of the changed model, which may no longer exist. */
  readonly entityId: number;
  /** A readable name for the changed model while it exists, such as a user's email; null otherwise. */
  readonly entityName: string | null;
  readonly details: Readonly<Record<string, unknown>>;
  /** ISO 8601 date and time. */
  readonly createdAt: string;
};
