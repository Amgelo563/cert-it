import {
  type CourseFieldSummary,
  fieldLabelKey,
  MaxCourseFields,
  MaxFieldLabelLength,
} from '@cert-it/shared';
import { hasRequiredColumns } from './buildImportRows';
import { type ColumnRole, ColumnRoleEnum, fieldIdOf } from './ColumnRoleEnum';

/** Returns the label a column's new field gets: its header, cut to the longest label a field takes. */
export function newFieldLabel(header: string): string {
  return header.trim().slice(0, MaxFieldLabelLength).trim();
}

/** Returns the message key of what to fix before the roles can be imported, or null if nothing. */
export function columnsProblem(
  roles: readonly ColumnRole[],
  headers: readonly string[],
  fields: readonly CourseFieldSummary[],
):
  | 'participantImport.needNameAndEmail'
  | 'fieldImport.duplicateField'
  | 'fieldImport.labelTaken'
  | 'fieldImport.tooManyFields'
  | null {
  if (!hasRequiredColumns(roles)) return 'participantImport.needNameAndEmail';

  const mapped = roles.flatMap((role) => {
    const id = fieldIdOf(role);
    return id === null ? [] : [id];
  });
  if (new Set(mapped).size !== mapped.length) {
    return 'fieldImport.duplicateField';
  }

  const labels = roles.flatMap((role, index) =>
    role === ColumnRoleEnum.New
      ? [fieldLabelKey(newFieldLabel(headers[index] ?? ''))]
      : [],
  );
  const taken = new Set(fields.map((field) => fieldLabelKey(field.label)));
  if (
    new Set(labels).size !== labels.length
    || labels.some((label) => label === '' || taken.has(label))
  ) {
    return 'fieldImport.labelTaken';
  }

  return fields.length + labels.length > MaxCourseFields
    ? 'fieldImport.tooManyFields'
    : null;
}
