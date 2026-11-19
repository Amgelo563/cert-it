import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { CourseId } from '../../course/Course';
import { courseTable } from '../../course/repository/courseTable';
import type { UserId } from '../../user/User';
import { userTable } from '../../user/repository/userTable';
import type { JobId } from '../Job';
import { JobStatusEnum, type JobStatus } from '../JobStatusEnum';
import type { JobTask } from '../JobTask';
import type { JobType } from '../JobTypeEnum';

export const jobTable = sqliteTable(
  'jobs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }).$type<JobId>(),
    type: text('type').notNull().$type<JobType>(),
    courseId: integer('course_id')
      .notNull()
      .references(() => courseTable.id, { onDelete: 'cascade' })
      .$type<CourseId>(),
    payload: text('payload', { mode: 'json' })
      .notNull()
      .$type<JobTask['payload']>(),
    status: text('status')
      .notNull()
      .default(JobStatusEnum.Pending)
      .$type<JobStatus>(),
    progress: integer('progress').notNull().default(0),
    total: integer('total').notNull(),
    error: text('error'),
    createdBy: integer('created_by')
      .notNull()
      .references(() => userTable.id)
      .$type<UserId>(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    startedAt: integer('started_at', { mode: 'timestamp_ms' }),
    finishedAt: integer('finished_at', { mode: 'timestamp_ms' }),
  },
  (table) => [index('jobs_course_id_index').on(table.courseId)],
);
