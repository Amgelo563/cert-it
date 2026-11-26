import { UserNameMaxLength, type UserSummary } from '@cert-it/shared';
import { Alert, Button, Group, Modal, Stack, TextInput } from '@mantine/core';
import { isNotEmpty, useForm } from '@mantine/form';
import { IconAlertCircle } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { describeApiError } from '../../app/api/describeApiError';
import { useApiClient } from '../../app/api/useApiClient';

type RenameUserModalProps = {
  /** The user to rename, or null while closed. */
  user: UserSummary | null;
  onClose: () => void;
  onRenamed: (user: UserSummary) => void;
};

/** Changes the name a user is shown with in the panel. */
export function RenameUserModal({
  user,
  onClose,
  onRenamed,
}: RenameUserModalProps) {
  const { t, i18n } = useTranslation();
  const api = useApiClient();
  const [error, setError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm({
    mode: 'controlled',
    initialValues: { name: '' },
    validate: { name: isNotEmpty(t('users.nameRequired')) },
    transformValues: (values) => ({ name: values.name.trim() }),
  });

  // refill on open, for the user it opens with
  useEffect(() => {
    if (!user) return;
    const values = { name: user.name };
    form.setValues(values);
    form.resetDirty(values);
    form.clearErrors();
    setError(null);
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- form is stable
  }, [user]);

  const submit = form.onSubmit(async (json) => {
    if (!user) return;
    setSubmitting(true);
    setError(null);
    try {
      const renamed = await api.request((routes) =>
        routes.users[':id'].$patch({ param: { id: String(user.id) }, json }),
      );
      onRenamed(renamed);
    } catch (caught) {
      setError(caught);
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <Modal
      opened={user !== null}
      onClose={onClose}
      title={t('users.renameTitle')}
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
            label={t('users.name')}
            description={user?.email}
            maxLength={UserNameMaxLength}
            required
            data-autofocus
            {...form.getInputProps('name')}
          />
          <Group justify="flex-end" mt="xs">
            <Button variant="subtle" color="gray" onClick={onClose}>
              {t('auth.cancel')}
            </Button>
            <Button type="submit" loading={submitting}>
              {t('users.renameSubmit')}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
