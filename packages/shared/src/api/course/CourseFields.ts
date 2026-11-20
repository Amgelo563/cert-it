import { enum as zEnum, string } from 'zod';
import { LocaleEnum } from '../../i18n/LocaleEnum';

/** Schemas of the editable fields of a course, shared by its create and update requests. */
export const CourseFields = {
  name: string().trim().min(1).max(200),
  locale: zEnum(LocaleEnum),
  dateFormat: string().trim().min(1).max(64),
};
