import { Button, Stack, Text, Title } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Surface } from '../layout/Surface';
import { AdminPathEnum } from '../router/AdminPathEnum';

/** Shown for admin paths that match no page. */
export function NotFoundPage() {
  const { t } = useTranslation();

  return (
    <Surface p="xl">
      <Stack align="center" gap="sm" ta="center">
        <Title order={2}>{t('errors.notFoundTitle')}</Title>
        <Text c="dimmed">{t('errors.notFoundDescription')}</Text>
        <Button component={Link} to={AdminPathEnum.Home} mt="sm">
          {t('errors.backHome')}
        </Button>
      </Stack>
    </Surface>
  );
}
