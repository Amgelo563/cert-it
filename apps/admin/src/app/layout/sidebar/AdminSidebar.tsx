import { ActionIcon, Box, ScrollArea, Text } from '@mantine/core';
import { IconCertificate, IconX } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router';
import { AdminPathEnum } from '../../router/AdminPathEnum';
import { AdminNavigation } from './AdminNavigation';
import classes from './AdminSidebar.module.css';

type AdminSidebarProps = {
  /** Called after navigating and by the close button, to hide the sidebar on phones. */
  onClose: () => void;
};

/** Logo and navigation sections of the admin panel. */
export function AdminSidebar({ onClose }: AdminSidebarProps) {
  const { t } = useTranslation();

  return (
    <div className={classes.sidebar}>
      <div className={classes.header}>
        <NavLink
          to={AdminPathEnum.Home}
          className={classes.logo}
          onClick={onClose}
        >
          <span className={classes.logoMark}>
            <IconCertificate size={20} stroke={1.8} />
          </span>
          <span>{t('app.name')}</span>
        </NavLink>
        <ActionIcon
          hiddenFrom="sm"
          onClick={onClose}
          aria-label={t('layout.toggleNavigation')}
        >
          <IconX size={18} />
        </ActionIcon>
      </div>

      <ScrollArea component="nav" aria-label={t('layout.navigationLabel')}>
        <div className={classes.sections}>
          {AdminNavigation.map((section) => (
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
                  <Icon size={20} stroke={1.6} />
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
