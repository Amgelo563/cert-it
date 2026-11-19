export const PermissionEnum = {
  /** View courses, participants and certificates. */
  ViewRecords: 'view_records',
  /** Create and edit courses, templates and fonts. */
  EditCourses: 'edit_courses',
  /** Import and edit participants. */
  EditParticipants: 'edit_participants',
  /** Issue, edit and regenerate certificates. */
  IssueCertificates: 'issue_certificates',
  /** Revoke and reinstate certificates. */
  RevokeCertificates: 'revoke_certificates',
  /** Permanently delete courses, participants and certificates. */
  DeleteRecords: 'delete_records',
  DeleteFonts: 'delete_fonts',
  /** Manage users and their roles. */
  ManageUsers: 'manage_users',
  ViewAuditLog: 'view_audit_log',
} as const;

/** An action in the admin panel that only some roles can take. */
export type Permission = (typeof PermissionEnum)[keyof typeof PermissionEnum];
