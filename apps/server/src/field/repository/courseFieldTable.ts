import type { CourseFieldType } from '@cert-it/shared';
import { integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';
import type { CourseId } from '../../course/Course';
import { courseTable } from '../../course/repository/courseTable';
import type { CourseFieldId } from '../CourseField';

export const courseFieldTable = sqliteTable(
  'course_fields',
  {
    id: integer('id')
      .primaryKey({ autoIncrement: true })
      .$type<CourseFieldId>(),
    courseId: integer('course_id')
      .notNull()
      .references(() => courseTable.id, { onDelete: 'cascade' })
      .$type<CourseId>(),
    label: text('label').notNull(),
    labelKey: text('label_key').notNull(),
    type: text('type').notNull().$type<CourseFieldType>(),
    required: integer('required', { mode: 'boolean' }).notNull().default(false),
    position: integer('position').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [unique().on(table.courseId, table.labelKey)],
);
