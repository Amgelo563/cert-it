import {
  index,
  integer,
  primaryKey,
  sqliteTable,
} from 'drizzle-orm/sqlite-core';
import type { FontId } from '../../font/Font';
import { fontTable } from '../../font/repository/fontTable';
import type { TemplateVersionId } from '../TemplateVersion';
import { templateVersionTable } from './templateVersionTable';

export const templateVersionFontTable = sqliteTable(
  'template_version_fonts',
  {
    templateVersionId: integer('template_version_id')
      .notNull()
      .references(() => templateVersionTable.id, { onDelete: 'cascade' })
      .$type<TemplateVersionId>(),
    // no cascade: a font can't be deleted while a template version uses it
    fontId: integer('font_id')
      .notNull()
      .references(() => fontTable.id)
      .$type<FontId>(),
  },
  (table) => [
    primaryKey({ columns: [table.templateVersionId, table.fontId] }),
    index('template_version_fonts_font_id_index').on(table.fontId),
  ],
);
