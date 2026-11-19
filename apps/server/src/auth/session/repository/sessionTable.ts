import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { UserId } from '../../../user/User';
import { userTable } from '../../../user/repository/userTable';
import type { SessionId } from '../Session';

export const sessionTable = sqliteTable(
  'sessions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }).$type<SessionId>(),
    tokenHash: text('token_hash').notNull().unique(),
    userId: integer('user_id')
      .notNull()
      .references(() => userTable.id, { onDelete: 'cascade' })
      .$type<UserId>(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [index('sessions_user_id_index').on(table.userId)],
);
