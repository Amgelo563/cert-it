import type { AuditAction, AuditEntity } from '@cert-it/shared';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { UserId } from '../../user/User';
import { userTable } from '../../user/repository/userTable';
import type { AuditEntryId } from '../AuditEntry';

export const auditLogTable = sqliteTable('audit_log', {
  id: integer('id').primaryKey({ autoIncrement: true }).$type<AuditEntryId>(),
  userId: integer('user_id')
    .references(() => userTable.id)
    .$type<UserId>(),
  action: text('action').notNull().$type<AuditAction>(),
  entity: text('entity').notNull().$type<AuditEntity>(),
  entityId: integer('entity_id').notNull(),
  details: text('details', { mode: 'json' })
    .notNull()
    .$type<Readonly<Record<string, unknown>>>()
    .$defaultFn(() => ({})),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
});
