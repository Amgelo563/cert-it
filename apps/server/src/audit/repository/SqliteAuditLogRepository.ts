import {
  AbstractSqliteRepository,
  type Page,
  type PageRequest,
} from '@cert-it/data';
import { desc } from 'drizzle-orm';
import type { AuditEntry } from '../AuditEntry';
import type { AuditLogRepository } from './AuditLogRepository';
import { auditLogTable } from './auditLogTable';

export class SqliteAuditLogRepository
  extends AbstractSqliteRepository<AuditEntry, typeof auditLogTable>
  implements AuditLogRepository
{
  protected readonly table = auditLogTable;

  public list(page: PageRequest): Page<AuditEntry> {
    return this.findPage(page, { orderBy: [desc(auditLogTable.id)] });
  }

  // rows are only written through the typed create, so they match their pair
  protected toModel(row: typeof auditLogTable.$inferSelect): AuditEntry {
    return row as AuditEntry;
  }
}
