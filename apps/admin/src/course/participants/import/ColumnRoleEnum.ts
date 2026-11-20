/** What a CSV column holds, as the editor maps it. */
export const ColumnRoleEnum = {
  Name: 'name',
  Email: 'email',
  /** Kept with the participant, under the column's header. */
  Extra: 'extra',
  Ignore: 'ignore',
} as const;

/** What a CSV column holds. */
export type ColumnRole = (typeof ColumnRoleEnum)[keyof typeof ColumnRoleEnum];
