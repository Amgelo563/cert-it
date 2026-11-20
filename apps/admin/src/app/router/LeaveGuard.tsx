import { Button, Group, Modal, Stack, Text } from '@mantine/core';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useBlocker } from 'react-router';

type LeaveGuardProps = {
  /** Whether there's something to lose, such as unsaved changes. */
  when: boolean;
};

/** Asks before leaving the page while `when` is true: a modal for links inside the panel, and the browser's own prompt for reloading or closing the tab. */
export function LeaveGuard({ when }: LeaveGuardProps) {
  const { t } = useTranslation();
  // changes within the page, such as its query, aren't leaving it
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      when && currentLocation.pathname !== nextLocation.pathname,
  );

  // browsers show their own text, so none is given
  useEffect(() => {
    if (!when) return;

    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [when]);

  // open exactly while a navigation waits on the answer
  return (
    <Modal
      opened={blocker.state === 'blocked'}
      onClose={() => blocker.reset?.()}
      title={t('leaveGuard.title')}
    >
      <Stack gap="lg">
        <Text size="sm">{t('leaveGuard.text')}</Text>
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={() => blocker.reset?.()}>
            {t('leaveGuard.stay')}
          </Button>
          <Button color="red" onClick={() => blocker.proceed?.()}>
            {t('leaveGuard.leave')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
