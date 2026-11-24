import { integer, sqliteTable } from 'drizzle-orm/sqlite-core';

// status indexes of deleted certificates, filled by a trigger, so they stay revoked and are never given out again
export const retiredStatusIndexTable = sqliteTable('retired_status_indexes', {
  statusIndex: integer('status_index').primaryKey(),
});
