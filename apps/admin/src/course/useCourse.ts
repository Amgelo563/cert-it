import type { CourseFieldSummary, CourseSummary } from '@cert-it/shared';
import { useOutletContext } from 'react-router';

/** What a course's page passes to its tabs. */
export type CourseContext = {
  course: CourseSummary;
  /** Loads the course again, such as after a change to it. */
  reload: () => void;
  /** The course's fields, in their order. */
  fields: readonly CourseFieldSummary[];
  /** Loads the fields again, such as after one is added. */
  reloadFields: () => void;
};

/** Returns the course whose page the tab is on. */
export function useCourse(): CourseContext {
  return useOutletContext<CourseContext>();
}
