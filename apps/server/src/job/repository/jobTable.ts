import { sqliteJobColumns, sqliteJobIndexes } from '@cert-it/jobs';
import { index, integer, sqliteTable } from 'drizzle-orm/sqlite-core';
import type { CourseId } from '../../course/Course';
import { courseTable } from '../../course/repository/courseTable';
import type { UserId } from '../../user/User';
import { userTable } from '../../user/repository/userTable';
import type { JobTask } from '../JobTask';
import type { JobType } from '@cert-it/shared';

export const jobTable = sqliteTable(
  'jobs',
  {
    ...sqliteJobColumns<JobType, JobTask['payload']>(),
    courseId: integer('course_id')
      .notNull()
      .references(() => courseTable.id, { onDelete: 'cascade' })
      .$type<CourseId>(),
    createdBy: integer('created_by')
      .notNull()
      .references(() => userTable.id)
      .$type<UserId>(),
  },
  (table) => [
    ...sqliteJobIndexes(table, 'jobs'),
    index('jobs_course_id_index').on(table.courseId),
  ],
);
