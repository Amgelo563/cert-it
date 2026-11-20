import type { SQLiteColumn, SQLiteTable } from 'drizzle-orm/sqlite-core';

/** A SQLite table with the columns from sqliteJobColumns. */
export type SqliteJobTable = SQLiteTable & {
  id: SQLiteColumn;
  type: SQLiteColumn;
  payload: SQLiteColumn;
  status: SQLiteColumn;
  progress: SQLiteColumn;
  total: SQLiteColumn;
  output: SQLiteColumn;
  error: SQLiteColumn;
  createdAt: SQLiteColumn;
  startedAt: SQLiteColumn;
  finishedAt: SQLiteColumn;
};
