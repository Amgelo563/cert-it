import type { JobSummary, ParticipantSummary } from '@cert-it/shared';
import {
  Alert,
  Button,
  Group,
  Modal,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { isNotEmpty, useForm } from '@mantine/form';
import { IconAlertCircle } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { describeApiError } from '../../../app/api/describeApiError';
import { useApiClient } from '../../../app/api/useApiClient';

type EditCertificateModalProps = {
  courseId: number;
  /** The participant whose certificate to edit, or null while closed. */
  participant: ParticipantSummary | null;
  onClose: () => void;
  onSaved: (job: JobSummary) => void;
};

/** Fixes the name or date printed on a certificate, which renders it again with the same code and template version. */
export function EditCertificateModal({
  courseId,
  participant,
  onClose,
  onSaved,
}: EditCertificateModalProps) {
  const { t, i18n } = useTranslation();
  const api = useApiClient();
  const [error, setError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);
  const certificate = participant?.certificate ?? null;

  const form = useForm({
    mode: 'controlled',
    initialValues: { name: '', issueDate: '' },
    validate: {
      name: isNotEmpty(t('certificates.nameRequired')),
      issueDate: isNotEmpty(t('certificates.dateRequired')),
    },
    transformValues: (values) => ({
      name: values.name.trim(),
      issueDate: values.issueDate,
    }),
  });

  // refill on open, for the certificate it opens with
  useEffect(() => {
    if (!participant?.certificate) return;
    const values = {
      name: participant.name,
      issueDate: participant.certificate.issueDate,
    };
    form.setValues(values);
    form.resetDirty(values);
    form.clearErrors();
    setError(null);
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- form is stable
  }, [participant]);

  const submit = form.onSubmit(async (values) => {
    if (!participant || !certificate) return;
    // only what changed; saving nothing renders it again all the same
    const json = {
      ...(values.name === participant.name ? {} : { name: values.name }),
      ...(values.issueDate === certificate.issueDate
        ? {}
        : { issueDate: values.issueDate }),
    };
    setSubmitting(true);
    setError(null);
    try {
      const job = await api.request((routes) =>
        routes.courses[':courseId'].certificates[':id'].$patch({
          param: { courseId: String(courseId), id: String(certificate.id) },
          json:
            Object.keys(json).length > 0
              ? json
              : { issueDate: certificate.issueDate },
        }),
      );
      onSaved(job);
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
      title={t('certificates.editTitle')}
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
          <Text size="sm">{t('certificates.editText')}</Text>
          <TextInput
            label={t('certificates.nameLabel')}
            description={t('certificates.nameDescription')}
            maxLength={200}
            required
            data-autofocus
            {...form.getInputProps('name')}
          />
          <TextInput
            type="date"
            label={t('certificates.issueDateLabel')}
            required
            maw={220}
            {...form.getInputProps('issueDate')}
          />
          <Group justify="flex-end" mt="xs">
            <Button variant="subtle" color="gray" onClick={onClose}>
              {t('auth.cancel')}
            </Button>
            <Button type="submit" loading={submitting}>
              {t('certificates.editSubmit')}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
