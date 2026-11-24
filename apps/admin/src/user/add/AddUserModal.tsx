import {
  ApiErrorCodeEnum,
  type CreatedUserResponse,
  type Role,
  RoleEnum,
} from '@cert-it/shared';
import {
  Alert,
  Button,
  Group,
  Modal,
  Select,
  Stack,
  TextInput,
} from '@mantine/core';
import { isEmail, useForm } from '@mantine/form';
import { IconAlertCircle } from '@tabler/icons-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { describeApiError } from '../../app/api/describeApiError';
import { ApiRequestError } from '../../app/api/errors/ApiRequestError';
import { useApiClient } from '../../app/api/useApiClient';

type AddUserModalProps = {
  opened: boolean;
  onClose: () => void;
  /** Called with the new user and the random password to hand over. */
  onCreated: (created: CreatedUserResponse) => void;
};

/** Form to add a user by email and role; the server picks a temporary password. */
export function AddUserModal({
  opened,
  onClose,
  onCreated,
}: AddUserModalProps) {
  const { t, i18n } = useTranslation();
  const api = useApiClient();
  const [error, setError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<{ email: string; role: Role }>({
    mode: 'controlled',
    initialValues: { email: '', role: RoleEnum.Viewer },
    validate: { email: isEmail(t('users.invalidEmail')) },
  });

  // cleared once the modal is gone, so nothing changes while it fades out
  const reset = () => {
    form.reset();
    setError(null);
  };

  const submit = form.onSubmit(async (json) => {
    setSubmitting(true);
    setError(null);
    try {
      const created = await api.request((routes) =>
        routes.users.$post({ json }),
      );
      onCreated(created);
    } catch (caught) {
      if (ApiRequestError.matches(caught, ApiErrorCodeEnum.EmailTaken)) {
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
      onExitTransitionEnd={reset}
      title={t('users.addTitle')}
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
            label={t('users.email')}
            type="email"
            maxLength={254}
            required
            data-autofocus
            {...form.getInputProps('email')}
          />
          <Select
            label={t('users.role')}
            description={t(`roleDescriptions.${form.values.role}`)}
            data={Object.values(RoleEnum).map((role) => ({
              value: role,
              label: t(`roles.${role}`),
            }))}
            allowDeselect={false}
            required
            {...form.getInputProps('role')}
          />
          <Group justify="flex-end" mt="xs">
            <Button variant="subtle" color="gray" onClick={onClose}>
              {t('auth.cancel')}
            </Button>
            <Button type="submit" loading={submitting}>
              {t('users.addSubmit')}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
