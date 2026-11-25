import {
  ApiErrorCodeEnum,
  type CourseFieldSummary,
  type CourseSummary,
  type FieldValue,
  type FieldValuesInput,
  type ParticipantSummary,
} from '@cert-it/shared';
import { Alert, Button, Group, Modal, Stack, TextInput } from '@mantine/core';
import { isEmail, isNotEmpty, useForm } from '@mantine/form';
import { IconAlertCircle } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { describeApiError } from '../../../app/api/describeApiError';
import { ApiRequestError } from '../../../app/api/errors/ApiRequestError';
import { useApiClient } from '../../../app/api/useApiClient';
import { FieldValueInput } from '../../fields/FieldValueInput';

type ParticipantFormModalProps = {
  opened: boolean;
  course: Pick<CourseSummary, 'id' | 'locale' | 'dateFormat'>;
  /** The course's fields, one input each. */
  fields: readonly CourseFieldSummary[];
  /** The participant to edit, or null to add one. */
  participant: ParticipantSummary | null;
  onClose: () => void;
  onSaved: (participant: ParticipantSummary) => void;
};

type Values = Record<string, FieldValue | undefined>;

/** Form to add a participant to a course or change one's name, email and field values. */
export function ParticipantFormModal({
  opened,
  course,
  fields,
  participant,
  onClose,
  onSaved,
}: ParticipantFormModalProps) {
  const { t, i18n } = useTranslation();
  const api = useApiClient();
  const [error, setError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);
  const [values, setValues] = useState<Values>({});
  const [missing, setMissing] = useState<ReadonlySet<number>>(new Set());

  const form = useForm({
    mode: 'controlled',
    initialValues: { name: '', email: '' },
    validate: {
      name: isNotEmpty(t('participants.fieldRequired')),
      email: isEmail(t('participants.invalidEmail')),
    },
    transformValues: (entered) => ({
      name: entered.name.trim(),
      email: entered.email.trim(),
    }),
  });

  // refill on open, for the participant it opens with
  useEffect(() => {
    if (!opened) return;
    const entered = {
      name: participant?.name ?? '',
      email: participant?.email ?? '',
    };
    form.setValues(entered);
    form.resetDirty(entered);
    form.clearErrors();
    setValues({ ...participant?.fieldValues });
    setMissing(new Set());
    setError(null);
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- form is stable
  }, [opened, participant]);

  // only the changed values on an edit, null for a cleared one
  const fieldValuesOf = (): FieldValuesInput => {
    const current = participant?.fieldValues ?? {};
    return Object.fromEntries(
      fields.flatMap((field) => {
        const id = String(field.id);
        const value = values[id];
        if (value === current[id]) return [];
        return [[id, value ?? null] as const];
      }),
    );
  };

  const submit = form.onSubmit(async (entered) => {
    const empty = fields.filter(
      (field) => field.required && values[String(field.id)] === undefined,
    );
    setMissing(new Set(empty.map((field) => field.id)));
    if (empty.length > 0) return;

    setSubmitting(true);
    setError(null);
    const param = { courseId: String(course.id) };
    const fieldValues = fieldValuesOf();
    const json = {
      ...entered,
      ...(Object.keys(fieldValues).length > 0 ? { fieldValues } : {}),
    };
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
      // cleared once the modal is gone, so the next opening shows no old errors
      onExitTransitionEnd={() => {
        form.clearErrors();
        setError(null);
      }}
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
          {fields.map((field) => (
            <FieldValueInput
              key={field.id}
              field={field}
              course={course}
              value={values[String(field.id)]}
              error={
                missing.has(field.id)
                  ? t('participants.fieldRequired')
                  : undefined
              }
              onChange={(value) => {
                setValues((current) => ({
                  ...current,
                  [String(field.id)]: value,
                }));
                setMissing((current) => {
                  const next = new Set(current);
                  next.delete(field.id);
                  return next;
                });
              }}
            />
          ))}
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
