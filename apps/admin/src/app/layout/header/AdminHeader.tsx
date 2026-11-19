import { ActionIcon, Group, Tooltip } from '@mantine/core';
import { IconLayoutSidebar } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { ColorSchemeToggle } from './ColorSchemeToggle';
import { LanguagePicker } from './LanguagePicker';

type AdminHeaderProps = {
  onToggleNavigation: () => void;
};

/** Top bar: navigation toggle on the left, language and color scheme on the right. */
export function AdminHeader({ onToggleNavigation }: AdminHeaderProps) {
  const { t } = useTranslation();

  return (
    <Group h="100%" px={{ base: 'md', sm: 'xl' }} justify="space-between">
      <Tooltip label={t('layout.toggleNavigation')}>
        <ActionIcon
          size="lg"
          onClick={onToggleNavigation}
          aria-label={t('layout.toggleNavigation')}
        >
          <IconLayoutSidebar size={20} stroke={1.6} />
        </ActionIcon>
      </Tooltip>

      <Group gap={4} wrap="nowrap">
        <LanguagePicker />
        <ColorSchemeToggle />
      </Group>
    </Group>
  );
}
