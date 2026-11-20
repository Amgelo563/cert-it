import type { ImportRow } from '@cert-it/shared';
import { type ColumnRole, ColumnRoleEnum } from './ColumnRoleEnum';
import type { CsvTable } from './CsvTable';

/** Whether the roles have exactly one name and one email column, as an import needs. */
export function hasRequiredColumns(roles: readonly ColumnRole[]): boolean {
  const count = (role: ColumnRole) => roles.filter((r) => r === role).length;
  return count(ColumnRoleEnum.Name) === 1 && count(ColumnRoleEnum.Email) === 1;
}

/** Turns the CSV rows into import rows, with extra columns keyed by their header. */
export function buildImportRows(
  table: CsvTable,
  roles: readonly ColumnRole[],
): ImportRow[] {
  const nameIndex = roles.indexOf(ColumnRoleEnum.Name);
  const emailIndex = roles.indexOf(ColumnRoleEnum.Email);
  const extraKeys = extraColumnKeys(table.headers, roles);

  return table.rows.map(({ cells }) => {
    const extra = Object.fromEntries(
      [...extraKeys].map(([index, key]) => [key, cells[index] ?? '']),
    );
    return {
      name: cells[nameIndex] ?? '',
      email: cells[emailIndex] ?? '',
      ...(extraKeys.size > 0 ? { extra } : {}),
    };
  });
}

// repeated or blank headers get a number, so no column overwrites another
function extraColumnKeys(
  headers: readonly string[],
  roles: readonly ColumnRole[],
): Map<number, string> {
  const keys = new Map<number, string>();
  const used = new Set<string>();

  roles.forEach((role, index) => {
    if (role !== ColumnRoleEnum.Extra) return;
    const base = headers[index]?.trim() || `column ${index + 1}`;
    let key = base;
    for (let n = 2; used.has(key); n += 1) key = `${base} (${n})`;
    used.add(key);
    keys.set(index, key);
  });
  return keys;
}
