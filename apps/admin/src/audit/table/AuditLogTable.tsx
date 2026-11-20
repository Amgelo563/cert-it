import {
  type AuditAction,
  AuditActionEnum,
  AuditEntityEnum,
  type AuditEntrySummary,
  RoleEnum,
} from '@cert-it/shared';
import { type MantineColor, Stack, Text } from '@mantine/core';
import { DataTable } from 'mantine-datatable';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { enumMessageKeys } from '../../app/i18n/enumMessageKeys';
import { MonoFigure } from '../../app/layout/MonoFigure';
import { StatusLabel } from '../../app/layout/StatusLabel';

const ActionKeys = enumMessageKeys(AuditActionEnum);

const EntityKeys = enumMessageKeys(AuditEntityEnum);

// green for additions, red for removals, gray for the rest
const ActionColors: Record<AuditAction, MantineColor> = {
  [AuditActionEnum.Create]: 'teal',
  [AuditActionEnum.Import]: 'teal',
  [AuditActionEnum.Issue]: 'teal',
  [AuditActionEnum.Reinstate]: 'teal',
  [AuditActionEnum.Delete]: 'red',
  [AuditActionEnum.Revoke]: 'red',
  [AuditActionEnum.Update]: 'gray',
  [AuditActionEnum.Regenerate]: 'gray',
  [AuditActionEnum.Login]: 'gray',
  [AuditActionEnum.ChangePassword]: 'gray',
  [AuditActionEnum.ResetPassword]: 'gray',
};

type AuditLogTableProps = {
  entries: readonly AuditEntrySummary[];
  total: number;
  page: number;
  pageSize: number;
  loading: boolean;
  onPageChange: (page: number) => void;
};

/** One page of audit log entries: when, who, what they did, to what, and the details. */
export function AuditLogTable({
  entries,
  total,
  page,
  pageSize,
  loading,
  onPageChange,
}: AuditLogTableProps) {
  const { t, i18n } = useTranslation();
  const dates = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.language, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
    [i18n.language],
  );

  // the known detail fields, translated; anything else is shown as it is
  const describeDetail = (key: string, value: unknown): string => {
    if (key === 'role') {
      const role = Object.values(RoleEnum).find((r) => r === value);
      if (role) return `${t('auditLog.detailRole')}: ${t(`roles.${role}`)}`;
    }
    if (key === 'active' && typeof value === 'boolean') {
      return `${t('auditLog.detailStatus')}: ${
        value ? t('users.active') : t('users.inactive')
      }`;
    }
    return `${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`;
  };

  return (
    <DataTable<AuditEntrySummary>
      records={[...entries]}
      idAccessor="id"
      fetching={loading}
      minHeight={entries.length === 0 ? 200 : undefined}
      highlightOnHover
      verticalSpacing="sm"
      noRecordsText={t('auditLog.empty')}
      loadingText={t('app.loading')}
      totalRecords={total}
      recordsPerPage={pageSize}
      page={page}
      onPageChange={onPageChange}
      paginationText={({ from, to, totalRecords }) =>
        t('table.range', { from, to, total: totalRecords })
      }
      getPaginationControlProps={(control) => ({
        'aria-label': t(`table.${control}Page`),
      })}
      columns={[
        {
          accessor: 'createdAt',
          title: t('auditLog.when'),
          noWrap: true,
          render: (entry) => (
            <MonoFigure>{dates.format(new Date(entry.createdAt))}</MonoFigure>
          ),
        },
        {
          accessor: 'userEmail',
          title: t('auditLog.who'),
          noWrap: true,
          render: (entry) => (
            <Text size="sm" fw={500}>
              {entry.userId === null
                ? t('auditLog.system')
                : (entry.userEmail
                  ?? t('auditLog.removedUser', { id: entry.userId }))}
            </Text>
          ),
        },
        {
          accessor: 'action',
          title: t('auditLog.action'),
          noWrap: true,
          render: (entry) => (
            <StatusLabel color={ActionColors[entry.action]}>
              {t(`auditLog.actions.${ActionKeys[entry.action]}`)}
            </StatusLabel>
          ),
        },
        {
          accessor: 'entityName',
          title: t('auditLog.target'),
          noWrap: true,
          render: (entry) => (
            <Stack gap={0}>
              <Text size="xs" c="dimmed">
                {t(`auditLog.entities.${EntityKeys[entry.entity]}`)}
              </Text>
              {entry.entityName === null ? (
                <MonoFigure>#{entry.entityId}</MonoFigure>
              ) : (
                <Text size="sm">{entry.entityName}</Text>
              )}
            </Stack>
          ),
        },
        {
          accessor: 'details',
          title: t('auditLog.details'),
          render: (entry) => (
            <Text size="sm" c="dimmed">
              {Object.entries(entry.details)
                .map(([key, value]) => describeDetail(key, value))
                .join(' · ')}
            </Text>
          ),
        },
      ]}
    />
  );
}
