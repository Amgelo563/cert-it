import { Alert, Group, Stack, Text } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ApiRoutes } from '../app/api/ApiClient';
import { describeApiError } from '../app/api/describeApiError';
import { useApiRequest } from '../app/api/useApiRequest';
import { PageHeader } from '../app/layout/PageHeader';
import { Surface } from '../app/layout/Surface';
import { AuditLogTable } from './table/AuditLogTable';

const PageSize = 25;

/** Every change made in the panel, newest first. */
export function AuditLogPage() {
  const { t, i18n } = useTranslation();
  const [page, setPage] = useState(1);

  const entries = useApiRequest(
    useCallback(
      (routes: ApiRoutes) =>
        routes.audit.$get({
          query: { page: String(page), size: String(PageSize) },
        }),
      [page],
    ),
  );

  return (
    <Stack gap="xl">
      <PageHeader
        title={t('auditLog.title')}
        description={t('auditLog.description')}
      />

      <Surface p="lg">
        <Stack gap="md">
          <Group justify="space-between">
            <Text fw={500} size="lg">
              {t('auditLog.listTitle')}
            </Text>
            {entries.data && (
              <Text c="dimmed" size="sm">
                {t('auditLog.count', { count: entries.data.total })}
              </Text>
            )}
          </Group>
          {entries.error !== null && (
            <Alert
              color="red"
              variant="light"
              icon={<IconAlertCircle size={18} stroke={1.5} />}
            >
              {describeApiError(entries.error, i18n)}
            </Alert>
          )}
          <AuditLogTable
            entries={entries.data?.items ?? []}
            total={entries.data?.total ?? 0}
            page={page}
            pageSize={PageSize}
            loading={entries.loading}
            onPageChange={setPage}
          />
        </Stack>
      </Surface>
    </Stack>
  );
}
