import { AdminPathEnum } from '../app/router/AdminPathEnum';

/** The tabs of a course's page, as the last segment of their path. */
export const CourseTabEnum = {
  Participants: 'participants',
  Certificates: 'certificates',
  Template: 'template',
  Settings: 'settings',
} as const;

/** A tab of a course's page. */
export type CourseTab = (typeof CourseTabEnum)[keyof typeof CourseTabEnum];

/** Returns the path of a course's page, on the given tab. */
export function coursePath(
  courseId: number,
  tab: CourseTab = CourseTabEnum.Participants,
): string {
  return `${AdminPathEnum.Course.replace(':courseId', String(courseId))}/${tab}`;
}
