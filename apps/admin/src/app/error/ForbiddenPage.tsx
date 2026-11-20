import { Button, Stack, Text, Title } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Surface } from '../layout/Surface';
import { AdminPathEnum } from '../router/AdminPathEnum';

/** Shown for pages the user's role can't open, such as from an old link. */
export function ForbiddenPage() {
  const { t } = useTranslation();

  return (
    <Surface p="xl">
      <Stack align="center" gap="sm" ta="center">
        <Title order={2}>{t('errors.forbiddenTitle')}</Title>
        <Text c="dimmed">{t('errors.forbiddenDescription')}</Text>
        <Button component={Link} to={AdminPathEnum.Home} mt="sm">
          {t('errors.backHome')}
        </Button>
      </Stack>
    </Surface>
  );
}
