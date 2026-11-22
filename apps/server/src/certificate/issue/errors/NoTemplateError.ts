import { TaggedError } from 'better-result';
import type { CourseId } from '../../../course/Course';

/** An error for issuing certificates in a course that has no template yet. */
export class NoTemplateError extends TaggedError('NoTemplateError')<{
  courseId: CourseId;
  message: string;
}> {
  constructor(args: { courseId: CourseId }) {
    super({ ...args, message: 'The course has no template.' });
  }
}
