export const OnboardingStepEnum = {
  CreateCourse: 'create_course',
  DesignTemplate: 'design_template',
  AddParticipants: 'add_participants',
  IssueCertificates: 'issue_certificates',
  /** Looks around a course, for roles that can't edit one. */
  BrowseCourse: 'browse_course',
  ViewCertificate: 'view_certificate',
  InviteUser: 'invite_user',
} as const;

/** A flow the getting started guide teaches. */
export type OnboardingStep =
  (typeof OnboardingStepEnum)[keyof typeof OnboardingStepEnum];
