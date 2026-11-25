export const TourTargetEnum = {
  CoursesAdd: 'courses-add',
  CoursesTable: 'courses-table',
  CourseTabs: 'course-tabs',
  ParticipantsAdd: 'participants-add',
  ParticipantsImport: 'participants-import',
  ParticipantsTable: 'participants-table',
  CertificatesIssue: 'certificates-issue',
  CertificatesTable: 'certificates-table',
  TemplateDesigner: 'template-designer',
  TemplateFonts: 'template-fonts',
  /** The fonts modal's tabs: stored fonts, the catalog and upload. */
  FontsModal: 'fonts-modal',
  /** The alert shown while no font is loaded. */
  TemplateNeedsFont: 'template-needs-font',
  TemplateSave: 'template-save',
  UsersAdd: 'users-add',
  UsersTable: 'users-table',
  SampleCertificate: 'sample-certificate',
} as const;

/** An element a tour can point at, marked with a `data-tour` attribute of this value. */
export type TourTarget = (typeof TourTargetEnum)[keyof typeof TourTargetEnum];

/** Returns the CSS selector of a tour target. */
export function tourSelector(target: TourTarget): string {
  return `[data-tour="${target}"]`;
}
