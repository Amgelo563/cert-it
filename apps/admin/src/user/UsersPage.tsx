import { Stack } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../app/layout/PageHeader';

/** The admin panel's users and their roles. */
export function UsersPage() {
  const { t } = useTranslation();

  return (
    <Stack gap="xl">
      <PageHeader
        title={t('users.title')}
        description={t('users.description')}
      />
    </Stack>
  );
}
