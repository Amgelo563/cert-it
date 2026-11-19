export const RoleEnum = {
  Admin: 'admin',
  Editor: 'editor',
  Viewer: 'viewer',
} as const;

/** A set of permissions an admin panel user has. */
export type Role = (typeof RoleEnum)[keyof typeof RoleEnum];
