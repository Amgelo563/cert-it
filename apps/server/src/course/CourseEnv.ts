import type { AuthEnv } from '../auth/AuthEnv';
import type { Course } from './Course';

/** The Hono environment of routes under a course, once its course is loaded. */
export type CourseEnv = {
  Variables: AuthEnv['Variables'] & {
    /** The course named in the path. */
    course: Course;
  };
};
