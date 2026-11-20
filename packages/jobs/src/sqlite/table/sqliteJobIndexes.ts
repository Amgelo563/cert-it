import { index, type SQLiteColumn } from 'drizzle-orm/sqlite-core';

/** Returns the indexes every job table needs, named after the given table. Keeps finding the next pending job fast as finished jobs pile up. */
export function sqliteJobIndexes(
  table: { id: SQLiteColumn; status: SQLiteColumn },
  tableName: string,
) {
  return [index(`${tableName}_status_id_index`).on(table.status, table.id)];
}
