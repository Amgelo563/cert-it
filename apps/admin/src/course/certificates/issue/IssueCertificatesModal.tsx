import { type CourseSummary, type JobSummary } from '@cert-it/shared';
import { Alert, Button, Group, Modal, Stack, Text } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconAlertCircle, IconCalendar } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { describeApiError } from '../../../app/api/describeApiError';
import { useApiClient } from '../../../app/api/useApiClient';

type IssueCertificatesModalProps = {
  opened: boolean;
  /** The course, whose language and date format the date is shown in. */
  course: Pick<CourseSummary, 'id' | 'locale' | 'dateFormat'>;
  /** The checked participants, or null for everyone without a certificate. */
  participantIds: readonly number[] | null;
  /** How many will be issued, for the text. */
  count: number;
  onClose: () => void;
  onIssued: (job: JobSummary) => void;
};

/** Asks for the issue date, then adds a job that issues certificates to the checked participants or to everyone without one. */
export function IssueCertificatesModal({
  opened,
  course,
  participantIds,
  count,
  onClose,
  onIssued,
}: IssueCertificatesModalProps) {
  const { t, i18n } = useTranslation();
  const api = useApiClient();
  const [issueDate, setIssueDate] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);

  // the next opening starts empty, cleared once the modal is gone
  const reset = () => {
    setIssueDate('');
    setError(null);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const job = await api.request((routes) =>
        routes.courses[':courseId'].certificates.issue.$post({
          param: { courseId: String(course.id) },
          json: {
            ...(participantIds ? { participantIds: [...participantIds] } : {}),
            ...(issueDate ? { issueDate } : {}),
          },
        }),
      );
      onIssued(job);
    } catch (caught) {
      setError(caught);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      onExitTransitionEnd={reset}
      title={t('certificates.issueTitle')}
    >
      <form onSubmit={(event) => void submit(event)} noValidate>
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
          <Text size="sm">
            {participantIds
              ? t('certificates.issueSelectedText', { count })
              : t('certificates.issueAllText', { count })}
          </Text>
          {/* shown as it will be printed, in the course's format and language */}
          <DatePickerInput
            label={t('certificates.issueDateLabel')}
            description={t('certificates.issueDateDescription')}
            placeholder={t('certificates.issueDateToday', {
              date: dayjs().locale(course.locale).format(course.dateFormat),
            })}
            value={issueDate || null}
            onChange={(value) => setIssueDate(value ?? '')}
            valueFormat={course.dateFormat}
            locale={course.locale}
            leftSection={<IconCalendar size={16} stroke={1.5} />}
            clearable
            popoverProps={{ withinPortal: true }}
          />
          <Group justify="flex-end" mt="xs">
            <Button variant="subtle" color="gray" onClick={onClose}>
              {t('auth.cancel')}
            </Button>
            <Button type="submit" loading={submitting} data-autofocus>
              {t('certificates.issueSubmit')}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
