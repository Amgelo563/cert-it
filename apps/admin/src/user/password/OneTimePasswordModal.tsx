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
import {
  IconAlertTriangle,
  IconCheck,
  IconCopy,
  IconInfoCircle,
} from '@tabler/icons-react';
import { useEffect, useRef, useState } from 'react';
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
  // keyed by password so a new one starts uncopied
  const [copiedFor, setCopiedFor] = useState<string | null>(null);
  const [confirmingFor, setConfirmingFor] = useState<string | null>(null);
  const copied = issued !== null && copiedFor === issued.password;
  const confirming = issued !== null && confirmingFor === issued.password;
  const copyRef = useRef<HTMLButtonElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);

  // keep focus on the safe button when the view swaps
  useEffect(() => {
    (confirming ? backRef : copyRef).current?.focus();
  }, [confirming]);

  // closing before copying would lose the password for good
  const requestClose = () => {
    if (copied) return onClose();
    setConfirmingFor(confirming ? null : (issued?.password ?? null));
  };

  return (
    <Modal
      opened={issued !== null}
      onClose={requestClose}
      title={t('users.passwordTitle')}
      closeOnClickOutside={false}
    >
      {issued && confirming && (
        <Stack gap="md">
          <Alert
            variant="light"
            color="yellow"
            icon={<IconAlertTriangle size={18} stroke={1.5} />}
          >
            {t('users.notCopiedText', { email: issued.email })}
          </Alert>
          <Group justify="flex-end">
            <Button variant="subtle" color="red" onClick={onClose}>
              {t('users.closeWithoutCopying')}
            </Button>
            <Button ref={backRef} onClick={() => setConfirmingFor(null)}>
              {t('users.backToPassword')}
            </Button>
          </Group>
        </Stack>
      )}
      {issued && !confirming && (
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
              {({ copied: justCopied, copy }) => (
                <Button
                  variant="light"
                  color={justCopied ? 'teal' : undefined}
                  ref={copyRef}
                  data-autofocus
                  leftSection={
                    justCopied ? (
                      <IconCheck size={16} stroke={1.5} />
                    ) : (
                      <IconCopy size={16} stroke={1.5} />
                    )
                  }
                  onClick={() => {
                    copy();
                    setCopiedFor(issued.password);
                  }}
                >
                  {justCopied ? t('users.copied') : t('users.copy')}
                </Button>
              )}
            </CopyButton>
          </Group>
          <Alert
            variant="light"
            icon={<IconInfoCircle size={18} stroke={1.5} />}
          >
            {t('users.passwordOnce')}
          </Alert>
          <Group justify="flex-end">
            <Button onClick={requestClose}>{t('users.done')}</Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}
