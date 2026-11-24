import type { AuditAction, AuditEntity } from '@cert-it/shared';
import type { DatabaseService } from '../database/DatabaseService';
import type { UserId } from '../user/User';
import type { AuditEntry } from './AuditEntry';

type AuditLogOptions = {
  database: DatabaseService;
};

/** Records changes in the audit log. */
export class AuditLog {
  protected readonly database: DatabaseService;

  constructor(options: AuditLogOptions) {
    this.database = options.database;
  }

  public static create(options: { database: DatabaseService }): AuditLog {
    return new AuditLog(options);
  }

  /** Appends an entry to the audit log. */
  public record(entry: {
    /** The user who made the change, or null if the app made it on its own. */
    userId: UserId | null;
    action: AuditAction;
    entity: AuditEntity;
    entityId: number;
    details?: Readonly<Record<string, unknown>>;
  }): AuditEntry {
    return this.database.getRepositories().auditLog.create(entry).unwrap();
  }
}
