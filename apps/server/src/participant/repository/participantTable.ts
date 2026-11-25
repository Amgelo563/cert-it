import type { FieldValues } from '@cert-it/shared';
import { integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';
import type { CourseId } from '../../course/Course';
import { courseTable } from '../../course/repository/courseTable';
import type { NormalizedEmail } from '../../util/email/NormalizedEmail';
import type { ParticipantId } from '../Participant';

export const participantTable = sqliteTable(
  'participants',
  {
    id: integer('id')
      .primaryKey({ autoIncrement: true })
      .$type<ParticipantId>(),
    courseId: integer('course_id')
      .notNull()
      .references(() => courseTable.id, { onDelete: 'cascade' })
      .$type<CourseId>(),
    name: text('name').notNull(),
    email: text('email').notNull().$type<NormalizedEmail>(),
    fieldValues: text('field_values', { mode: 'json' })
      .notNull()
      .$type<FieldValues>()
      .$defaultFn(() => ({})),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [unique().on(table.courseId, table.email)],
);
