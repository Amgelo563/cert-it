import { AuditLog } from '../../../src/audit/AuditLog';
import type { AuditEntry } from '../../../src/audit/AuditEntry';
import type { DatabaseService } from '../../../src/database/DatabaseService';

/** An AuditLog whose every write fails, to check that the change it records is rolled back. */
export class StubFailingAuditLog extends AuditLog {
  public static readonly Failure = new Error('audit log unavailable');

  constructor(database: DatabaseService) {
    super({ database });
  }

  public override record(): AuditEntry {
    throw StubFailingAuditLog.Failure;
  }
}
