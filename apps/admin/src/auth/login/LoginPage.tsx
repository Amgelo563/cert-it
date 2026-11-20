import { ApiErrorCodeEnum, PasswordLength } from '@cert-it/shared';
import { Alert, Button, PasswordInput, Stack, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconAlertCircle } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { describeApiError } from '../../app/api/describeApiError';
import { ApiRequestError } from '../../app/api/errors/ApiRequestError';
import { useApiClient } from '../../app/api/useApiClient';
import { AuthLayout } from '../layout/AuthLayout';
import { useAuth } from '../useAuth';

/** Email and password form; RequireGuest moves on once it logs in. */
export function LoginPage() {
  const { t, i18n } = useTranslation();
  const api = useApiClient();
  const { setUser } = useAuth();
  const [error, setError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);
  // while the server refuses more attempts, so the button can't be spammed
  const [waitSeconds, setWaitSeconds] = useState(0);

  const form = useForm({
    mode: 'uncontrolled',
    initialValues: { email: '', password: '' },
    validate: {
      email: (value) => (value.trim() ? null : t('auth.fieldRequired')),
      password: (value) => (value ? null : t('auth.fieldRequired')),
    },
  });

  useEffect(() => {
    if (waitSeconds <= 0) return;
    const timeout = setTimeout(() => setWaitSeconds(0), waitSeconds * 1000);
    return () => clearTimeout(timeout);
  }, [waitSeconds]);

  const submit = form.onSubmit(async (values) => {
    setSubmitting(true);
    setError(null);
    try {
      setUser(
        await api.request((routes) =>
          routes.auth.login.$post({ json: values }),
        ),
      );
    } catch (caught) {
      setError(caught);
      if (ApiRequestError.matches(caught, ApiErrorCodeEnum.TooManyAttempts)) {
        setWaitSeconds(caught.retryAfterSeconds ?? 0);
      }
      form.setFieldValue('password', '');
      setSubmitting(false);
    }
  });

  return (
    <AuthLayout
      title={t('auth.loginTitle')}
      description={t('auth.loginDescription')}
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
            label={t('auth.email')}
            type="email"
            autoComplete="username"
            maxLength={254}
            required
            key={form.key('email')}
            {...form.getInputProps('email')}
          />
          <PasswordInput
            label={t('auth.password')}
            autoComplete="current-password"
            maxLength={PasswordLength.max}
            required
            key={form.key('password')}
            {...form.getInputProps('password')}
          />
          <Button
            type="submit"
            fullWidth
            mt="xs"
            loading={submitting}
            disabled={waitSeconds > 0}
          >
            {t('auth.login')}
          </Button>
        </Stack>
      </form>
    </AuthLayout>
  );
}
