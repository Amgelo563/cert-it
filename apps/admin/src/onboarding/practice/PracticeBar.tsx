import { Button, Group, Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { useOnboarding } from '../useOnboarding';
import classes from './PracticeBar.module.css';

/** A quiet bar above the page while it shows practice data, with a way out. */
export function PracticeBar() {
  const { t } = useTranslation();
  const { practicing, exitPractice } = useOnboarding();
  if (!practicing) return null;

  return (
    <Group
      className={classes.bar}
      justify="space-between"
      wrap="nowrap"
      gap="md"
    >
      <Text size="sm">{t('onboarding.practice.bar')}</Text>
      <Button variant="subtle" color="gray" size="xs" onClick={exitPractice}>
        {t('onboarding.practice.exit')}
      </Button>
    </Group>
  );
}
