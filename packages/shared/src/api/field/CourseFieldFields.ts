import { boolean, enum as zEnum, string } from 'zod';
import { CourseFieldTypeEnum } from '../../field/CourseFieldTypeEnum';

/** Most fields one course takes. */
export const MaxCourseFields = 20;

/** Longest label a course field takes; labels are only shown in the panel. */
export const MaxFieldLabelLength = 20;

/** Schemas of the editable parts of a course field, shared by its requests. */
export const CourseFieldFields = {
  label: string().trim().min(1).max(MaxFieldLabelLength),
  type: zEnum(CourseFieldTypeEnum),
  required: boolean(),
};
