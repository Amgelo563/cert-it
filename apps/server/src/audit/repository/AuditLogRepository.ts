import type { DuplicateModelError, Page, PageRequest } from '@cert-it/data';
import type { Result } from 'better-result';
import type { UserId } from '../../user/User';
import type { AuditAction } from '../AuditActionEnum';
import type { AuditEntity } from '../AuditEntityEnum';
import type { AuditEntry } from '../AuditEntry';

/** An object that appends to and queries the audit log. */
export interface AuditLogRepository {
  /** Appends an entry to the audit log. */
  create(data: {
    userId: UserId | null;
    action: AuditAction;
    entity: AuditEntity;
    entityId: number;
    details?: Readonly<Record<string, unknown>>;
  }): Result<AuditEntry, DuplicateModelError>;

  /** Returns a page of the audit log, newest first. */
  list(page: PageRequest): Page<AuditEntry>;
}
