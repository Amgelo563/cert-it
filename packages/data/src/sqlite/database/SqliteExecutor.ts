import type { RunResult } from 'better-sqlite3';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

/** A synchronous SQLite database or transaction that queries can run on. */
export type SqliteExecutor = BaseSQLiteDatabase<'sync', RunResult>;
