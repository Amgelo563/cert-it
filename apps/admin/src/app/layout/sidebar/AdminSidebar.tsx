import { ActionIcon, Box, ScrollArea, Text } from '@mantine/core';
import { IconX } from '@tabler/icons-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router';
import { usePermissions } from '../../../auth/usePermissions';
import { AdminPagePermissions } from '../../router/AdminPagePermissions';
import { AdminLogo } from '../AdminLogo';
import { AdminNavigation } from './AdminNavigation';
import classes from './AdminSidebar.module.css';

type AdminSidebarProps = {
  /** Called after navigating and by the close button, to hide the sidebar on phones. */
  onClose: () => void;
};

/** Logo and the navigation sections the user's role can open. */
export function AdminSidebar({ onClose }: AdminSidebarProps) {
  const { t } = useTranslation();
  const can = usePermissions();
  // sections left without links are hidden too
  const sections = useMemo(
    () =>
      AdminNavigation.map((section) => ({
        ...section,
        links: section.links.filter(({ to }) => can(AdminPagePermissions[to])),
      })).filter((section) => section.links.length > 0),
    [can],
  );

  return (
    <div className={classes.sidebar}>
      <div className={classes.header}>
        <AdminLogo onClick={onClose} />
        <ActionIcon
          hiddenFrom="sm"
          onClick={onClose}
          aria-label={t('layout.toggleNavigation')}
        >
          <IconX size={18} stroke={1.5} />
        </ActionIcon>
      </div>

      <ScrollArea component="nav" aria-label={t('layout.navigationLabel')}>
        <div className={classes.sections}>
          {sections.map((section) => (
            <Box key={section.title} className={classes.section}>
              <Text className={classes.sectionTitle}>
                {t(`navigation.${section.title}`)}
              </Text>
              {section.links.map(({ label, icon: Icon, to }) => (
                <NavLink
                  key={label}
                  to={to}
                  end
                  className={classes.link}
                  onClick={onClose}
                >
                  <Icon size={18} stroke={1.5} />
                  {t(`navigation.${label}`)}
                </NavLink>
              ))}
            </Box>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
