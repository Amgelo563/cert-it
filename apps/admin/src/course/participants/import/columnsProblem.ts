import { MaxImportExtraColumns } from '@cert-it/shared';
import { hasRequiredColumns } from './buildImportRows';
import { type ColumnRole, ColumnRoleEnum } from './ColumnRoleEnum';

/** Returns the message key of what to fix before the roles can be imported, or null if nothing. */
export function columnsProblem(
  roles: readonly ColumnRole[],
):
  | 'participantImport.needNameAndEmail'
  | 'participantImport.tooManyExtras'
  | null {
  if (!hasRequiredColumns(roles)) return 'participantImport.needNameAndEmail';
  const extras = roles.filter((role) => role === ColumnRoleEnum.Extra).length;
  return extras > MaxImportExtraColumns
    ? 'participantImport.tooManyExtras'
    : null;
}
