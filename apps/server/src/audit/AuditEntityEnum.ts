export const AuditEntityEnum = {
  User: 'user',
  Course: 'course',
  Participant: 'participant',
  Font: 'font',
  TemplateVersion: 'template_version',
  Certificate: 'certificate',
  Job: 'job',
} as const;

/** The kind of model an audit log entry is about. */
export type AuditEntity =
  (typeof AuditEntityEnum)[keyof typeof AuditEntityEnum];
