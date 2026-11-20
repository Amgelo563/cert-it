import { Stack } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../app/layout/PageHeader';

/** Landing page of the admin panel. */
export function HomePage() {
  const { t } = useTranslation();

  return (
    <Stack gap="xl">
      <PageHeader title={t('home.title')} description={t('home.description')} />
    </Stack>
  );
}
