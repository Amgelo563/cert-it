import {
  Alert,
  Button,
  CopyButton,
  Group,
  Modal,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { IconCheck, IconCopy, IconInfoCircle } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';

/** A random password the server returned once, for a new or reset account. */
export type IssuedPassword = {
  email: string;
  password: string;
};

type OneTimePasswordModalProps = {
  /** The password to show, or null to keep the modal closed. */
  issued: IssuedPassword | null;
  onClose: () => void;
};

/** Shows a new account's password with a copy button; it can't be seen again once closed. */
export function OneTimePasswordModal({
  issued,
  onClose,
}: OneTimePasswordModalProps) {
  const { t } = useTranslation();

  return (
    <Modal
      opened={issued !== null}
      onClose={onClose}
      title={t('users.passwordTitle')}
      // closing by accident would lose the password for good
      closeOnClickOutside={false}
    >
      {issued && (
        <Stack gap="md">
          <Text size="sm">
            {t('users.passwordText', { email: issued.email })}
          </Text>
          <Group gap="xs" wrap="nowrap" align="flex-end">
            <TextInput
              flex={1}
              label={t('users.passwordLabel')}
              value={issued.password}
              readOnly
              styles={{
                input: { fontFamily: 'var(--mantine-font-family-monospace)' },
              }}
              onFocus={(event) => event.currentTarget.select()}
            />
            <CopyButton value={issued.password}>
              {({ copied, copy }) => (
                <Button
                  variant="light"
                  color={copied ? 'teal' : undefined}
                  leftSection={
                    copied ? (
                      <IconCheck size={16} stroke={1.6} />
                    ) : (
                      <IconCopy size={16} stroke={1.6} />
                    )
                  }
                  onClick={copy}
                >
                  {copied ? t('users.copied') : t('users.copy')}
                </Button>
              )}
            </CopyButton>
          </Group>
          <Alert
            variant="light"
            icon={<IconInfoCircle size={20} stroke={1.6} />}
          >
            {t('users.passwordOnce')}
          </Alert>
          <Group justify="flex-end">
            <Button onClick={onClose}>{t('users.done')}</Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}
