import { sql } from 'drizzle-orm';
import { check, integer, sqliteTable } from 'drizzle-orm/sqlite-core';

// one row, bumped by triggers on certificates whenever the status list changes
export const certificateStatusVersionTable = sqliteTable(
  'certificate_status_version',
  {
    id: integer('id').primaryKey(),
    version: integer('version').notNull().default(0),
  },
  (table) => [
    check('certificate_status_version_single_row', sql`${table.id} = 1`),
  ],
);
