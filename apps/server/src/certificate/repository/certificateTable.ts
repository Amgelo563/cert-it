import { CertificateStatusEnum, type CertificateStatus } from '@cert-it/shared';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { CourseId } from '../../course/Course';
import { courseTable } from '../../course/repository/courseTable';
import type { ParticipantId } from '../../participant/Participant';
import { participantTable } from '../../participant/repository/participantTable';
import type { TemplateVersionId } from '../../template/TemplateVersion';
import { templateVersionTable } from '../../template/repository/templateVersionTable';
import type { CertificateCode } from '../code/CertificateCode';
import type { CertificateId } from '../Certificate';

export const certificateTable = sqliteTable(
  'certificates',
  {
    id: integer('id')
      .primaryKey({ autoIncrement: true })
      .$type<CertificateId>(),
    code: text('code').notNull().unique().$type<CertificateCode>(),
    courseId: integer('course_id')
      .notNull()
      .references(() => courseTable.id, { onDelete: 'cascade' })
      .$type<CourseId>(),
    participantId: integer('participant_id')
      .notNull()
      .unique()
      .references(() => participantTable.id, { onDelete: 'cascade' })
      .$type<ParticipantId>(),
    // no cascade: template versions are kept while certificates use them
    templateVersionId: integer('template_version_id')
      .notNull()
      .references(() => templateVersionTable.id)
      .$type<TemplateVersionId>(),
    issueDate: text('issue_date').notNull(),
    status: text('status')
      .notNull()
      .default(CertificateStatusEnum.Active)
      .$type<CertificateStatus>(),
    revokedAt: integer('revoked_at', { mode: 'timestamp_ms' }),
    revokedReason: text('revoked_reason'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    index('certificates_course_id_index').on(table.courseId),
    index('certificates_template_version_id_index').on(table.templateVersionId),
  ],
);
