export const AuditActionEnum = {
  Create: 'create',
  Update: 'update',
  Delete: 'delete',
  Import: 'import',
  Reorder: 'reorder',
  Issue: 'issue',
  Regenerate: 'regenerate',
  Revoke: 'revoke',
  Reinstate: 'reinstate',
  Login: 'login',
  ChangePassword: 'change_password',
  ResetPassword: 'reset_password',
} as const;

/** A change recorded in the audit log. */
export type AuditAction =
  (typeof AuditActionEnum)[keyof typeof AuditActionEnum];
