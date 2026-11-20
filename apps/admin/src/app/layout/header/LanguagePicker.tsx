import { LocaleEnum } from '@cert-it/shared';
import { Button, Menu } from '@mantine/core';
import { IconCheck, IconLanguage } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';

/** Menu to change the panel's language; the choice is saved by AdminI18n. */
export function LanguagePicker() {
  const { t, i18n } = useTranslation();

  return (
    <Menu width={180} position="bottom-end">
      <Menu.Target>
        <Button
          variant="subtle"
          color="gray"
          px="sm"
          leftSection={<IconLanguage size={18} stroke={1.5} />}
          aria-label={t('language.switcherLabel')}
        >
          {i18n.language.toUpperCase()}
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>{t('language.switcherLabel')}</Menu.Label>
        {Object.values(LocaleEnum).map((locale) => (
          <Menu.Item
            key={locale}
            lang={locale}
            rightSection={
              i18n.language === locale ? (
                <IconCheck size={16} stroke={1.5} />
              ) : null
            }
            onClick={() => void i18n.changeLanguage(locale)}
          >
            {t('language.name', { lng: locale })}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}
