import { type OnboardingStep, OnboardingStepEnum } from '@cert-it/shared';
import { Button, Group, Modal, Stack, Text } from '@mantine/core';
import { IconCheck } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { enumMessageKeys } from '../../app/i18n/enumMessageKeys';
import { StatusLabel } from '../../app/layout/StatusLabel';
import classes from './OnboardingHub.module.css';

type OnboardingHubProps = {
  opened: boolean;
  onClose: () => void;
  /** The steps of the user's role, in order. */
  steps: readonly OnboardingStep[];
  completed: ReadonlySet<OnboardingStep>;
  dismissed: boolean;
  /** The step whose tour is being prepared, or null. */
  starting: OnboardingStep | null;
  onStart: (step: OnboardingStep) => void;
  onDismiss: () => void;
};

const StepKeys = enumMessageKeys(OnboardingStepEnum);

/** The getting started guide: each step with whether it's done and a button to take its tour. */
export function OnboardingHub({
  opened,
  onClose,
  steps,
  completed,
  dismissed,
  starting,
  onStart,
  onDismiss,
}: OnboardingHubProps) {
  const { t } = useTranslation();
  const next = steps.find((step) => !completed.has(step)) ?? null;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t('onboarding.hub.title')}
      size="lg"
    >
      <Stack gap="lg">
        <Text size="sm" c="dimmed">
          {next ? t('onboarding.hub.description') : t('onboarding.hub.allDone')}
        </Text>
        <ol className={classes.steps}>
          {steps.map((step, index) => {
            const done = completed.has(step);
            const key = StepKeys[step];
            return (
              <li key={step} className={classes.step}>
                <span
                  className={classes.marker}
                  data-state={done ? 'done' : step === next ? 'next' : 'todo'}
                  aria-hidden
                >
                  {done ? <IconCheck size={16} stroke={1.5} /> : index + 1}
                </span>
                <Group
                  className={classes.content}
                  justify="space-between"
                  align="flex-start"
                  wrap="nowrap"
                  gap="md"
                >
                  <Stack gap={4}>
                    <Group gap="sm">
                      <Text fw={500}>{t(`onboarding.steps.${key}.title`)}</Text>
                      <StatusLabel color={done ? 'teal' : 'gray'}>
                        {done
                          ? t('onboarding.hub.done')
                          : t('onboarding.hub.toDo')}
                      </StatusLabel>
                    </Group>
                    <Text size="sm" c="dimmed">
                      {t(`onboarding.steps.${key}.description`)}
                    </Text>
                  </Stack>
                  <Button
                    // done steps only offer a replay, so it stays quiet
                    {...(done
                      ? { variant: 'subtle', color: 'gray' }
                      : { variant: step === next ? 'filled' : 'light' })}
                    loading={starting === step}
                    disabled={starting !== null && starting !== step}
                    onClick={() => onStart(step)}
                  >
                    {done
                      ? t('onboarding.hub.replay')
                      : t('onboarding.hub.start')}
                  </Button>
                </Group>
              </li>
            );
          })}
        </ol>
        {!dismissed && next && (
          <Group justify="flex-start">
            <Button variant="subtle" color="gray" size="xs" onClick={onDismiss}>
              {t('onboarding.hub.dismiss')}
            </Button>
          </Group>
        )}
      </Stack>
    </Modal>
  );
}
