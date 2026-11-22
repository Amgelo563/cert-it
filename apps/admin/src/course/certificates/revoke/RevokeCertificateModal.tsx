import type { CertificateSummary, ParticipantSummary } from '@cert-it/shared';
import {
  Alert,
  Button,
  Group,
  Modal,
  Stack,
  Text,
  Textarea,
} from '@mantine/core';
import { isNotEmpty, useForm } from '@mantine/form';
import { IconAlertCircle } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { describeApiError } from '../../../app/api/describeApiError';
import { useApiClient } from '../../../app/api/useApiClient';

type RevokeCertificateModalProps = {
  courseId: number;
  /** The participant whose certificate to revoke, or null while closed. */
  participant: ParticipantSummary | null;
  onClose: () => void;
  onRevoked: (certificate: CertificateSummary) => void;
};

/** Asks for the reason, then revokes a participant's certificate. */
export function RevokeCertificateModal({
  courseId,
  participant,
  onClose,
  onRevoked,
}: RevokeCertificateModalProps) {
  const { t, i18n } = useTranslation();
  const api = useApiClient();
  const [error, setError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);
  const certificate = participant?.certificate ?? null;

  const form = useForm({
    mode: 'controlled',
    initialValues: { reason: '' },
    validate: { reason: isNotEmpty(t('certificates.reasonRequired')) },
    transformValues: (values) => ({ reason: values.reason.trim() }),
  });

  useEffect(() => {
    if (!participant) return;
    form.reset();
    setError(null);
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- form is stable
  }, [participant]);

  const submit = form.onSubmit(async (json) => {
    if (!certificate) return;
    setSubmitting(true);
    setError(null);
    try {
      const revoked = await api.request((routes) =>
        routes.courses[':courseId'].certificates[':id'].revoke.$post({
          param: { courseId: String(courseId), id: String(certificate.id) },
          json,
        }),
      );
      onRevoked(revoked);
    } catch (caught) {
      setError(caught);
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <Modal
      opened={participant !== null}
      onClose={onClose}
      title={t('certificates.revokeTitle')}
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
          <Text size="sm">
            {t('certificates.revokeText', {
              name: participant?.name ?? '',
              code: certificate?.code ?? '',
            })}
          </Text>
          <Textarea
            label={t('certificates.reasonLabel')}
            description={t('certificates.reasonDescription')}
            maxLength={500}
            autosize
            minRows={2}
            required
            data-autofocus
            {...form.getInputProps('reason')}
          />
          <Group justify="flex-end" mt="xs">
            <Button variant="subtle" color="gray" onClick={onClose}>
              {t('auth.cancel')}
            </Button>
            <Button type="submit" color="red" loading={submitting}>
              {t('certificates.revokeSubmit')}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
