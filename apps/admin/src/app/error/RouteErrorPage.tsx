import { Button, Center, Stack, Text, Title } from '@mantine/core';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouteError } from 'react-router';

/** Shown when a page throws or its chunk can't be loaded, such as after a new deploy. */
export function RouteErrorPage() {
  const { t } = useTranslation();
  const error = useRouteError();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Center mih="100vh" p="md">
      <Stack align="center" gap="sm" ta="center" maw={480}>
        <Title order={2}>{t('errors.unexpectedTitle')}</Title>
        <Text c="dimmed">{t('errors.unexpectedDescription')}</Text>
        <Button mt="sm" onClick={() => window.location.reload()}>
          {t('errors.reload')}
        </Button>
      </Stack>
    </Center>
  );
}
