import type { Template } from '@pdfme/common';
import { integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';
import type { CourseId } from '../../course/Course';
import { courseTable } from '../../course/repository/courseTable';
import type { UserId } from '../../user/User';
import { userTable } from '../../user/repository/userTable';
import type { TemplateVersionId } from '../TemplateVersion';

export const templateVersionTable = sqliteTable(
  'template_versions',
  {
    id: integer('id')
      .primaryKey({ autoIncrement: true })
      .$type<TemplateVersionId>(),
    courseId: integer('course_id')
      .notNull()
      .references(() => courseTable.id, { onDelete: 'cascade' })
      .$type<CourseId>(),
    version: integer('version').notNull(),
    template: text('template', { mode: 'json' })
      .notNull()
      .$type<Omit<Template, 'basePdf'>>(),
    basePdfPath: text('base_pdf_path').notNull(),
    createdBy: integer('created_by')
      .notNull()
      .references(() => userTable.id)
      .$type<UserId>(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [unique().on(table.courseId, table.version)],
);
