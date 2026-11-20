import {
  type ImportParticipantsResponse,
  type ImportRow,
  type ImportRowResult,
  type ImportRowStatus,
  ImportRowStatusEnum,
  ImportSkipReasonEnum,
} from '@cert-it/shared';
import {
  type MantineColor,
  SegmentedControl,
  Stack,
  Text,
} from '@mantine/core';
import { DataTable } from 'mantine-datatable';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { enumMessageKeys } from '../../../../app/i18n/enumMessageKeys';
import { MonoFigure } from '../../../../app/layout/MonoFigure';
import { StatusLabel } from '../../../../app/layout/StatusLabel';
import type { CsvTable } from '../CsvTable';

const PageSize = 50;

const AllFilter = 'all';

const StatusColors: Record<ImportRowStatus, MantineColor> = {
  [ImportRowStatusEnum.Create]: 'teal',
  [ImportRowStatusEnum.Update]: 'blue',
  [ImportRowStatusEnum.Skip]: 'gray',
  [ImportRowStatusEnum.Invalid]: 'red',
};

const ErrorKeys = {
  name_required: 'nameRequired',
  name_too_long: 'nameTooLong',
  email_invalid: 'emailInvalid',
} as const;

const SkipKeys = enumMessageKeys(ImportSkipReasonEnum);

type PreviewStepProps = {
  table: CsvTable;
  rows: readonly ImportRow[];
  preview: ImportParticipantsResponse;
};

type PreviewRecord = ImportRowResult & {
  line: number;
  name: string;
  email: string;
};

/** What the import would do with each row, filterable by outcome. */
export function PreviewStep({ table, rows, preview }: PreviewStepProps) {
  const { t, i18n } = useTranslation();
  const [filter, setFilter] = useState<string>(AllFilter);
  const [page, setPage] = useState(1);
  const numbers = useMemo(
    () => new Intl.NumberFormat(i18n.language),
    [i18n.language],
  );

  const records = useMemo(
    () =>
      preview.rows.map((result): PreviewRecord => ({
        ...result,
        line: table.rows[result.row]?.line ?? result.row + 2,
        name: rows[result.row]?.name ?? '',
        email: rows[result.row]?.email ?? '',
      })),
    [preview, rows, table],
  );
  const shown = useMemo(
    () =>
      filter === AllFilter
        ? records
        : records.filter((record) => record.status === filter),
    [filter, records],
  );

  // why the row ends up as it does, under its status
  const explain = (record: PreviewRecord): string | null => {
    if (record.errors) {
      return record.errors
        .map((error) => t(`participantImport.errors.${ErrorKeys[error]}`))
        .join(' · ');
    }
    if (record.reason === ImportSkipReasonEnum.DuplicateInFile) {
      const earlier = record.duplicateOf ?? 0;
      return t('participantImport.reasons.duplicateInFile', {
        line: table.rows[earlier]?.line ?? earlier + 2,
      });
    }
    if (record.reason) {
      return t(`participantImport.reasons.${SkipKeys[record.reason]}`, {
        name: record.existingName ?? '',
      });
    }
    if (record.status === ImportRowStatusEnum.Update) {
      return t('participantImport.previousName', {
        name: record.existingName ?? '',
      });
    }
    return null;
  };

  return (
    <Stack gap="md">
      <SegmentedControl
        value={filter}
        onChange={(value) => {
          setFilter(value);
          setPage(1);
        }}
        fullWidth
        data={[
          {
            value: AllFilter,
            label: `${t('participantImport.filterAll')} · ${numbers.format(records.length)}`,
          },
          ...Object.values(ImportRowStatusEnum).map((status) => ({
            value: status,
            label: `${t(`participantImport.groups.${status}`)} · ${numbers.format(preview.totals[status])}`,
          })),
        ]}
      />
      <DataTable<PreviewRecord>
        records={shown.slice((page - 1) * PageSize, page * PageSize)}
        idAccessor="row"
        minHeight={shown.length === 0 ? 160 : undefined}
        verticalSpacing="xs"
        noRecordsText={t('participantImport.noRows')}
        totalRecords={shown.length}
        recordsPerPage={PageSize}
        page={page}
        onPageChange={setPage}
        paginationText={({ from, to, totalRecords }) =>
          t('table.range', { from, to, total: totalRecords })
        }
        getPaginationControlProps={(control) => ({
          'aria-label': t(`table.${control}Page`),
        })}
        columns={[
          {
            accessor: 'line',
            title: t('participantImport.line'),
            width: 70,
            render: (record) => <MonoFigure>{record.line}</MonoFigure>,
          },
          {
            accessor: 'name',
            title: t('participants.name'),
            render: (record) => (
              <Text size="sm" lineClamp={1}>
                {record.name}
              </Text>
            ),
          },
          {
            accessor: 'email',
            title: t('participants.email'),
            render: (record) => (
              <Text size="sm" lineClamp={1}>
                {record.email}
              </Text>
            ),
          },
          {
            accessor: 'status',
            title: t('participantImport.result'),
            render: (record) => {
              const reason = explain(record);
              return (
                <Stack gap={2}>
                  <StatusLabel color={StatusColors[record.status]}>
                    {t(`participantImport.statuses.${record.status}`)}
                  </StatusLabel>
                  {reason && (
                    <Text size="xs" c="dimmed">
                      {reason}
                    </Text>
                  )}
                </Stack>
              );
            },
          },
        ]}
      />
    </Stack>
  );
}
