import { ApiErrorCodeEnum, PasswordLength } from '@cert-it/shared';
import { Alert, Button, Group, PasswordInput, Stack } from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconAlertCircle } from '@tabler/icons-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { describeApiError } from '../../app/api/describeApiError';
import { ApiRequestError } from '../../app/api/errors/ApiRequestError';
import { useApiClient } from '../../app/api/useApiClient';
import { AdminPathEnum } from '../../app/router/AdminPathEnum';
import { AuthLayout } from '../layout/AuthLayout';
import { useAuth } from '../useAuth';

/** Replaces the logged-in user's password, required before anything else after an account is created or reset. */
export function ChangePasswordPage() {
  const { t, i18n } = useTranslation();
  const api = useApiClient();
  const navigate = useNavigate();
  const { user, setUser, logout } = useAuth();
  const [error, setError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);
  const required = user?.mustChangePassword ?? false;

  const form = useForm({
    mode: 'uncontrolled',
    initialValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
    validate: {
      currentPassword: (value) => (value ? null : t('auth.fieldRequired')),
      newPassword: (value, values) => {
        if (value.length < PasswordLength.min) {
          return t('auth.passwordTooShort', { min: PasswordLength.min });
        }
        if (value.length > PasswordLength.max) {
          return t('auth.passwordTooLong', { max: PasswordLength.max });
        }
        return value === values.currentPassword
          ? t('apiErrors.codes.samePassword')
          : null;
      },
      confirmPassword: (value, values) =>
        value === values.newPassword ? null : t('auth.passwordsDontMatch'),
    },
  });

  const submit = form.onSubmit(async ({ currentPassword, newPassword }) => {
    setSubmitting(true);
    setError(null);
    try {
      const updated = await api.request((routes) =>
        routes.auth.password.$post({ json: { currentPassword, newPassword } }),
      );
      notifications.show({ color: 'teal', message: t('auth.passwordChanged') });
      setUser(updated);
      await navigate(AdminPathEnum.Home, { replace: true });
    } catch (caught) {
      // the wrong field gets the message, anything else goes above the form
      if (ApiRequestError.matches(caught, ApiErrorCodeEnum.WrongPassword)) {
        form.setFieldError('currentPassword', describeApiError(caught, i18n));
      } else {
        setError(caught);
      }
      setSubmitting(false);
    }
  });

  return (
    <AuthLayout
      title={t('auth.changePasswordTitle')}
      description={
        required
          ? t('auth.changePasswordRequired')
          : t('auth.changePasswordDescription', { min: PasswordLength.min })
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
          {/* lets password managers save the new password for the right account */}
          <input
            type="email"
            autoComplete="username"
            value={user?.email ?? ''}
            readOnly
            hidden
          />
          <PasswordInput
            visibilityToggleButtonProps={{
              'aria-label': t('auth.showPassword'),
            }}
            label={t('auth.currentPassword')}
            autoComplete="current-password"
            maxLength={PasswordLength.max}
            required
            key={form.key('currentPassword')}
            {...form.getInputProps('currentPassword')}
          />
          <PasswordInput
            visibilityToggleButtonProps={{
              'aria-label': t('auth.showPassword'),
            }}
            label={t('auth.newPassword')}
            description={t('auth.passwordTooShort', {
              min: PasswordLength.min,
            })}
            autoComplete="new-password"
            maxLength={PasswordLength.max}
            required
            key={form.key('newPassword')}
            {...form.getInputProps('newPassword')}
          />
          <PasswordInput
            visibilityToggleButtonProps={{
              'aria-label': t('auth.showPassword'),
            }}
            label={t('auth.confirmPassword')}
            autoComplete="new-password"
            maxLength={PasswordLength.max}
            required
            key={form.key('confirmPassword')}
            {...form.getInputProps('confirmPassword')}
          />
          <Group justify="space-between" mt="xs">
            {required ? (
              <Button
                variant="subtle"
                color="gray"
                onClick={() => void logout()}
              >
                {t('auth.logout')}
              </Button>
            ) : (
              <Button
                variant="subtle"
                color="gray"
                component={Link}
                to={AdminPathEnum.Home}
              >
                {t('auth.cancel')}
              </Button>
            )}
            <Button type="submit" loading={submitting}>
              {t('auth.changePassword')}
            </Button>
          </Group>
        </Stack>
      </form>
    </AuthLayout>
  );
}
