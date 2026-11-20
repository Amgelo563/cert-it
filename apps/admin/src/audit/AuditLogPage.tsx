import { Stack } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../app/layout/PageHeader';

/** Every change made in the panel, newest first. */
export function AuditLogPage() {
  const { t } = useTranslation();

  return (
    <Stack gap="xl">
      <PageHeader
        title={t('auditLog.title')}
        description={t('auditLog.description')}
      />
    </Stack>
  );
}
