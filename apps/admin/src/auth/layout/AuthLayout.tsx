import { Group, Stack, Text, Title } from '@mantine/core';
import { type ReactNode, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useBranding } from '../../app/branding/useBranding';
import { AdminLogo } from '../../app/layout/AdminLogo';
import { ColorSchemeToggle } from '../../app/layout/header/ColorSchemeToggle';
import { LanguagePicker } from '../../app/layout/header/LanguagePicker';
import { Surface } from '../../app/layout/Surface';
import classes from './AuthLayout.module.css';

type AuthLayoutProps = {
  title: string;
  description?: string;
  children: ReactNode;
};

/** A single card in the middle of the page, for login and password pages outside the panel's shell. */
export function AuthLayout({ title, description, children }: AuthLayoutProps) {
  const { t } = useTranslation();
  const { name } = useBranding();

  useEffect(() => {
    document.title = `${title} · ${t('app.title', { name })}`;
  }, [title, t, name]);

  return (
    <div className={classes.root}>
      <header className={classes.header}>
        <AdminLogo />
        <Group gap={4} wrap="nowrap">
          <LanguagePicker />
          <ColorSchemeToggle />
        </Group>
      </header>

      <main className={classes.main}>
        <Surface p="xl" className={classes.card}>
          <Stack gap="lg">
            <Stack gap={4}>
              <Title order={1} className={classes.title}>
                {title}
              </Title>
              {description && (
                <Text c="dimmed" size="sm">
                  {description}
                </Text>
              )}
            </Stack>
            {children}
          </Stack>
        </Surface>
      </main>
    </div>
  );
}
