import type { CourseSummary, Locale } from '@cert-it/shared';
import { Alert, Button, Group, Modal, Stack } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { describeApiError } from '../../app/api/describeApiError';
import { useApiClient } from '../../app/api/useApiClient';
import { CourseFormFields } from '../form/CourseFormFields';
import { courseFormValues, useCourseForm } from '../form/useCourseForm';

type AddCourseModalProps = {
  opened: boolean;
  /** Locale of new courses, as the site's default. */
  defaultLocale: Locale;
  onClose: () => void;
  onCreated: (course: CourseSummary) => void;
};

/** Form to create a course, starting from the site's default language. */
export function AddCourseModal({
  opened,
  defaultLocale,
  onClose,
  onCreated,
}: AddCourseModalProps) {
  const { t, i18n } = useTranslation();
  const api = useApiClient();
  const [error, setError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);
  const form = useCourseForm(courseFormValues(null, defaultLocale));

  // cleared once the modal is gone, so nothing changes while it fades out
  const reset = () => {
    form.reset();
    setError(null);
  };

  const submit = form.onSubmit(async (json) => {
    setSubmitting(true);
    setError(null);
    try {
      const course = await api.request((routes) =>
        routes.courses.$post({ json }),
      );
      onCreated(course);
    } catch (caught) {
      setError(caught);
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      onExitTransitionEnd={reset}
      title={t('courses.addTitle')}
    >
      <form onSubmit={submit} noValidate>
        <Stack gap="md">
          {error !== null && (
            <Alert
              color="red"
              variant="light"
              icon={<IconAlertCircle size={18} stroke={1.5} />}
            >
              {describeApiError(error, i18n)}
            </Alert>
          )}
          <CourseFormFields form={form} focusName />
          <Group justify="flex-end" mt="xs">
            <Button variant="subtle" color="gray" onClick={onClose}>
              {t('auth.cancel')}
            </Button>
            <Button type="submit" loading={submitting}>
              {t('courses.addSubmit')}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
