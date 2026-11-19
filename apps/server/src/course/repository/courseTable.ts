import type { Locale } from '@cert-it/shared';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { CourseId } from '../Course';

export const courseTable = sqliteTable('courses', {
  id: integer('id').primaryKey({ autoIncrement: true }).$type<CourseId>(),
  name: text('name').notNull(),
  locale: text('locale').notNull().$type<Locale>(),
  dateFormat: text('date_format').notNull(),
  lookupEnabled: integer('lookup_enabled', { mode: 'boolean' })
    .notNull()
    .default(true),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
});
