import { integer, text } from 'drizzle-orm/sqlite-core';
import type { JobId } from '../../shared/job/Job';
import { type JobStatus, JobStatusEnum } from '../../shared/job/JobStatusEnum';

/** Returns the columns every job table has, to spread into the app's table next to its own columns. */
export function sqliteJobColumns<Type extends string, Payload>() {
  return {
    id: integer('id').primaryKey({ autoIncrement: true }).$type<JobId>(),
    type: text('type').notNull().$type<Type>(),
    payload: text('payload', { mode: 'json' }).notNull().$type<Payload>(),
    status: text('status')
      .notNull()
      .default(JobStatusEnum.Pending)
      .$type<JobStatus>(),
    progress: integer('progress').notNull().default(0),
    total: integer('total'),
    output: text('output', { mode: 'json' }).$type<unknown>(),
    error: text('error'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    startedAt: integer('started_at', { mode: 'timestamp_ms' }),
    finishedAt: integer('finished_at', { mode: 'timestamp_ms' }),
  };
}
