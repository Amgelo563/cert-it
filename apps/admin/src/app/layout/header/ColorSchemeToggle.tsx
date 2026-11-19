import {
  ActionIcon,
  Tooltip,
  useComputedColorScheme,
  useMantineColorScheme,
} from '@mantine/core';
import { IconMoon, IconSun } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';

/** Switches between light and dark mode, starting from the system's. */
export function ColorSchemeToggle() {
  const { t } = useTranslation();
  const { setColorScheme } = useMantineColorScheme();
  const computed = useComputedColorScheme('light');
  const Icon = computed === 'dark' ? IconSun : IconMoon;

  return (
    <Tooltip label={t('layout.toggleColorScheme')}>
      <ActionIcon
        size="lg"
        onClick={() => setColorScheme(computed === 'dark' ? 'light' : 'dark')}
        aria-label={t('layout.toggleColorScheme')}
      >
        <Icon size={20} stroke={1.6} />
      </ActionIcon>
    </Tooltip>
  );
}
