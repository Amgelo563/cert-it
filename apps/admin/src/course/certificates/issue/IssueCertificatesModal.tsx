import type { JobSummary } from '@cert-it/shared';
import {
  Alert,
  Button,
  Group,
  Modal,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { describeApiError } from '../../../app/api/describeApiError';
import { useApiClient } from '../../../app/api/useApiClient';

type IssueCertificatesModalProps = {
  opened: boolean;
  courseId: number;
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
  courseId,
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

  // the next opening starts empty
  const close = () => {
    setIssueDate('');
    setError(null);
    onClose();
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const job = await api.request((routes) =>
        routes.courses[':courseId'].certificates.issue.$post({
          param: { courseId: String(courseId) },
          json: {
            ...(participantIds ? { participantIds: [...participantIds] } : {}),
            ...(issueDate ? { issueDate } : {}),
          },
        }),
      );
      setIssueDate('');
      onIssued(job);
    } catch (caught) {
      setError(caught);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal opened={opened} onClose={close} title={t('certificates.issueTitle')}>
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
          <TextInput
            type="date"
            label={t('certificates.issueDateLabel')}
            description={t('certificates.issueDateDescription')}
            value={issueDate}
            onChange={(event) => setIssueDate(event.currentTarget.value)}
            maw={220}
          />
          <Group justify="flex-end" mt="xs">
            <Button variant="subtle" color="gray" onClick={close}>
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
