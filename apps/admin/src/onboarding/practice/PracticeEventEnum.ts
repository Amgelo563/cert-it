export const PracticeEventEnum = {
  CourseCreated: 'course_created',
  TemplateSaved: 'template_saved',
  ParticipantsAdded: 'participants_added',
  CertificatesIssued: 'certificates_issued',
  /** A job of the practice finished making its certificates. */
  JobCompleted: 'job_completed',
  UserCreated: 'user_created',
} as const;

/** Something done in practice that a tour can wait for. */
export type PracticeEventType =
  (typeof PracticeEventEnum)[keyof typeof PracticeEventEnum];

/** Something done in practice, with what a tour needs to know about it. */
export type PracticeEvent =
  | { type: typeof PracticeEventEnum.CourseCreated; courseId: number }
  | {
      type: typeof PracticeEventEnum.TemplateSaved;
      courseId: number;
      /** Whether the saved version prints the participant's name. */
      hasName: boolean;
    }
  | { type: typeof PracticeEventEnum.ParticipantsAdded; courseId: number }
  | { type: typeof PracticeEventEnum.CertificatesIssued; courseId: number }
  | { type: typeof PracticeEventEnum.JobCompleted; courseId: number }
  | { type: typeof PracticeEventEnum.UserCreated };
