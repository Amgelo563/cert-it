/** What a CSV column holds, as the editor maps it, besides one of the course's fields. */
export const ColumnRoleEnum = {
  Name: 'name',
  Email: 'email',
  /** Becomes a new course field, named after the column's header. */
  New: 'new',
  Ignore: 'ignore',
} as const;

/** A role a column can have besides one of the course's fields. */
export type BasicColumnRole =
  (typeof ColumnRoleEnum)[keyof typeof ColumnRoleEnum];

/** A column that holds the values of a course field, by its ID. */
export type FieldColumnRole = `field:${number}`;

/** What a CSV column holds. */
export type ColumnRole = BasicColumnRole | FieldColumnRole;

/** Returns the role of a column that holds a course field's values. */
export function fieldRole(fieldId: number): FieldColumnRole {
  return `field:${fieldId}`;
}

/** Returns the ID of the course field a role maps to, or null if it maps to none. */
export function fieldIdOf(role: ColumnRole): number | null {
  if (!role.startsWith('field:')) return null;
  const id = Number(role.slice('field:'.length));
  return Number.isSafeInteger(id) ? id : null;
}

/** Returns whether the text is a column role, as a picker gives it. */
export function isColumnRole(value: string): value is ColumnRole {
  return (
    (Object.values(ColumnRoleEnum) as string[]).includes(value)
    || /^field:\d+$/.test(value)
  );
}
