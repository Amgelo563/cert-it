import { ApiErrorCodeEnum, type ParticipantSummary } from '@cert-it/shared';
import { Alert, Button, Group, Modal, Stack, TextInput } from '@mantine/core';
import { isEmail, isNotEmpty, useForm } from '@mantine/form';
import { IconAlertCircle } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { describeApiError } from '../../../app/api/describeApiError';
import { ApiRequestError } from '../../../app/api/errors/ApiRequestError';
import { useApiClient } from '../../../app/api/useApiClient';

type ParticipantFormModalProps = {
  opened: boolean;
  courseId: number;
  /** The participant to edit, or null to add one. */
  participant: ParticipantSummary | null;
  onClose: () => void;
  onSaved: (participant: ParticipantSummary) => void;
};

/** Form to add a participant to a course or change one's name and email. */
export function ParticipantFormModal({
  opened,
  courseId,
  participant,
  onClose,
  onSaved,
}: ParticipantFormModalProps) {
  const { t, i18n } = useTranslation();
  const api = useApiClient();
  const [error, setError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm({
    mode: 'controlled',
    initialValues: { name: '', email: '' },
    validate: {
      name: isNotEmpty(t('participants.fieldRequired')),
      email: isEmail(t('participants.invalidEmail')),
    },
    transformValues: (values) => ({
      name: values.name.trim(),
      email: values.email.trim(),
    }),
  });

  // refill on open, for the participant it opens with
  useEffect(() => {
    if (!opened) return;
    const values = {
      name: participant?.name ?? '',
      email: participant?.email ?? '',
    };
    form.setValues(values);
    form.resetDirty(values);
    form.clearErrors();
    setError(null);
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- form is stable
  }, [opened, participant]);

  const submit = form.onSubmit(async (json) => {
    setSubmitting(true);
    setError(null);
    const param = { courseId: String(courseId) };
    try {
      const saved = participant
        ? await api.request((routes) =>
            routes.courses[':courseId'].participants[':id'].$patch({
              param: { ...param, id: String(participant.id) },
              json,
            }),
          )
        : await api.request((routes) =>
            routes.courses[':courseId'].participants.$post({ param, json }),
          );
      onSaved(saved);
    } catch (caught) {
      if (
        ApiRequestError.matches(caught, ApiErrorCodeEnum.ParticipantEmailTaken)
      ) {
        form.setFieldError('email', describeApiError(caught, i18n));
      } else {
        setError(caught);
      }
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        participant ? t('participants.editTitle') : t('participants.addTitle')
      }
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
          <TextInput
            label={t('participants.name')}
            description={t('participants.nameDescription')}
            maxLength={200}
            required
            data-autofocus
            {...form.getInputProps('name')}
          />
          <TextInput
            label={t('participants.email')}
            description={t('participants.emailDescription')}
            type="email"
            maxLength={254}
            required
            {...form.getInputProps('email')}
          />
          <Group justify="flex-end" mt="xs">
            <Button variant="subtle" color="gray" onClick={onClose}>
              {t('auth.cancel')}
            </Button>
            <Button type="submit" loading={submitting}>
              {participant
                ? t('participants.editSubmit')
                : t('participants.addSubmit')}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
