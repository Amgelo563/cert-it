import {
  CourseDateFormatter,
  type CourseSummary,
  type Locale,
} from '@cert-it/shared';
import { isNotEmpty, useForm, type UseFormReturnType } from '@mantine/form';
import { useTranslation } from 'react-i18next';

/** The editable fields of a course, as its form holds them. */
export type CourseFormValues = {
  name: string;
  locale: Locale;
  dateFormat: string;
  lookupEnabled: boolean;
};

/** The form of a course's fields. */
export type CourseForm = UseFormReturnType<CourseFormValues>;

/** Returns a course's fields, or a new course's defaults for the given locale. */
export function courseFormValues(
  course: CourseSummary | null,
  defaultLocale: Locale,
): CourseFormValues {
  if (course) {
    return {
      name: course.name,
      locale: course.locale,
      dateFormat: course.dateFormat,
      lookupEnabled: course.lookupEnabled,
    };
  }

  return {
    name: '',
    locale: defaultLocale,
    dateFormat: CourseDateFormatter.DefaultFormats[defaultLocale],
    lookupEnabled: true,
  };
}

/** Returns a form for a course's fields, starting from the given values. */
export function useCourseForm(initialValues: CourseFormValues): CourseForm {
  const { t } = useTranslation();

  return useForm<CourseFormValues>({
    mode: 'controlled',
    initialValues,
    validate: {
      name: isNotEmpty(t('courses.fieldRequired')),
      dateFormat: isNotEmpty(t('courses.fieldRequired')),
    },
    transformValues: (values) => ({ ...values, name: values.name.trim() }),
  });
}
