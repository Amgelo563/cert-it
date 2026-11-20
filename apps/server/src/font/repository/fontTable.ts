import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { FontId } from '../Font';
import type { FontSource } from '@cert-it/shared';

export const fontTable = sqliteTable('fonts', {
  id: integer('id').primaryKey({ autoIncrement: true }).$type<FontId>(),
  sha256: text('sha256').notNull().unique(),
  family: text('family').notNull(),
  style: text('style').notNull(),
  source: text('source').notNull().$type<FontSource>(),
  fileName: text('file_name').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
});
