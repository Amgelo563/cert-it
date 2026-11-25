import {
  type CourseFieldSummary,
  CourseFieldTypeEnum,
  type ImportRow,
} from '@cert-it/shared';
import { type ColumnRole, ColumnRoleEnum, fieldIdOf } from './ColumnRoleEnum';
import type { CsvTable } from './CsvTable';
import {
  type ImageIndex,
  type ResolvedImage,
  resolveImage,
} from './ImageIndex';

/** The rows of an import, and the images they need uploaded first, by their stored name. */
export type BuiltImport = {
  readonly rows: ImportRow[];
  readonly uploads: ReadonlyMap<string, File>;
};

/** Whether the roles have exactly one name and one email column, as an import needs. */
export function hasRequiredColumns(roles: readonly ColumnRole[]): boolean {
  const count = (role: ColumnRole) => roles.filter((r) => r === role).length;
  return count(ColumnRoleEnum.Name) === 1 && count(ColumnRoleEnum.Email) === 1;
}

/**
 * Turns the CSV rows into import rows, with each field's cell by its ID.
 *
 * Image cells are matched to the given images and sent as the name the server stores them by; cells without a usable image are sent with the reason.
 *
 * @param roles One per column; columns for new fields must be mapped to them first.
 */
export async function buildImportRows(
  table: CsvTable,
  roles: readonly ColumnRole[],
  fields: readonly CourseFieldSummary[],
  images: ImageIndex = new Map(),
): Promise<BuiltImport> {
  const nameIndex = roles.indexOf(ColumnRoleEnum.Name);
  const emailIndex = roles.indexOf(ColumnRoleEnum.Email);
  const byId = new Map(fields.map((field) => [field.id, field]));
  const columns = roles.flatMap((role, index) => {
    const field = byId.get(fieldIdOf(role) ?? -1);
    return field ? [{ index, field }] : [];
  });
  const uploads = new Map<string, File>();
  const hashes = new Map<File, ResolvedImage>();

  const rows: ImportRow[] = [];
  for (const { cells } of table.rows) {
    const values: Record<string, string> = {};
    const fileErrors: NonNullable<ImportRow['fileErrors']> = {};

    for (const { index, field } of columns) {
      const cell = cells[index] ?? '';
      const id = String(field.id);
      if (field.type !== CourseFieldTypeEnum.Image || cell.trim() === '') {
        values[id] = cell;
        continue;
      }

      const resolved = await resolveImage(cell, images, hashes);
      if ('error' in resolved) {
        fileErrors[id] = resolved.error;
      } else {
        values[id] = resolved.fileName;
        uploads.set(resolved.fileName, resolved.file);
      }
    }

    rows.push({
      name: cells[nameIndex] ?? '',
      email: cells[emailIndex] ?? '',
      ...(Object.keys(values).length > 0 ? { fields: values } : {}),
      ...(Object.keys(fileErrors).length > 0 ? { fileErrors } : {}),
    });
  }
  return { rows, uploads };
}
