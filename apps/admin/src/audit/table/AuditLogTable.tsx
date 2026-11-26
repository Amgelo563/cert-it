import {
  type AuditAction,
  AuditActionEnum,
  type AuditDetailsMap,
  type AuditEntity,
  AuditEntityEnum,
  type AuditEntrySummary,
  type AuditRecord,
  FontSourceEnum,
  ImportModeEnum,
  ImportRowStatusEnum,
  type Role,
} from '@cert-it/shared';
import { type MantineColor, Stack, Text } from '@mantine/core';
import { DataTable } from 'mantine-datatable';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useTableScroll } from '../../app/layout/useTableScroll';
import { enumMessageKeys } from '../../app/i18n/enumMessageKeys';
import { useLocaleNames } from '../../app/i18n/useLocaleNames';
import { MonoFigure } from '../../app/layout/MonoFigure';
import { StatusLabel } from '../../app/layout/StatusLabel';

const ActionKeys = enumMessageKeys(AuditActionEnum);

const EntityKeys = enumMessageKeys(AuditEntityEnum);

const FontSourceKeys = enumMessageKeys(FontSourceEnum);

// green for additions, red for removals, gray for the rest
const ActionColors: Record<AuditAction, MantineColor> = {
  [AuditActionEnum.Create]: 'teal',
  [AuditActionEnum.Import]: 'teal',
  [AuditActionEnum.Issue]: 'teal',
  [AuditActionEnum.Reinstate]: 'teal',
  [AuditActionEnum.Delete]: 'red',
  [AuditActionEnum.Revoke]: 'red',
  [AuditActionEnum.Update]: 'gray',
  [AuditActionEnum.Reorder]: 'gray',
  [AuditActionEnum.Regenerate]: 'gray',
  [AuditActionEnum.Login]: 'gray',
  [AuditActionEnum.ChangePassword]: 'gray',
  [AuditActionEnum.ResetPassword]: 'gray',
};

type DetailDescribers = {
  [Entity in keyof AuditDetailsMap]: {
    [Action in keyof AuditDetailsMap[Entity]]: (
      details: AuditDetailsMap[Entity][Action],
    ) => string[];
  };
};

type CourseUpdate =
  AuditDetailsMap[typeof AuditEntityEnum.Course][typeof AuditActionEnum.Update];

type UserUpdate =
  AuditDetailsMap[typeof AuditEntityEnum.User][typeof AuditActionEnum.Update];

// one describer per entity and action; names the target column shows are left out
function useDetailDescriber(): (entry: AuditEntrySummary) => string[] {
  const { t, i18n } = useTranslation();
  const localeNames = useLocaleNames();
  // issue dates are calendar days, so they are read as UTC
  const days = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.language, {
        dateStyle: 'medium',
        timeZone: 'UTC',
      }),
    [i18n.language],
  );

  const label = (name: string, value: string | number) => `${name}: ${value}`;
  const day = (value: string) => days.format(new Date(`${value}T00:00:00Z`));
  const role = (value: Role) =>
    label(t('auditLog.detailRole'), t(`roles.${value}`));
  const status = (active: boolean, inactive: string) =>
    label(t('auditLog.detailStatus'), active ? t('users.active') : inactive);
  const code = (value: string) => label(t('auditLog.detailCode'), value);
  const none = () => [];

  const userUpdate = (d: UserUpdate) => [
    ...(d.name === undefined ? [] : [label(t('users.name'), d.name)]),
    ...(d.role === undefined ? [] : [role(d.role)]),
    ...(d.active === undefined ? [] : [status(d.active, t('users.inactive'))]),
  ];
  const courseUpdate = (d: CourseUpdate) => [
    ...(d.name === undefined ? [] : [label(t('courses.name'), d.name)]),
    ...(d.locale === undefined
      ? []
      : [label(t('courses.locale'), localeNames(d.locale))]),
    ...(d.dateFormat === undefined
      ? []
      : [label(t('courses.dateFormat'), d.dateFormat)]),
    ...(d.lookupEnabled === undefined
      ? []
      : [
          label(
            t('courses.lookup'),
            t(d.lookupEnabled ? 'courses.listed' : 'courses.hidden'),
          ),
        ]),
    ...(d.active === undefined
      ? []
      : [status(d.active, t('courses.archived'))]),
  ];

  const describers: DetailDescribers = {
    [AuditEntityEnum.User]: {
      [AuditActionEnum.Create]: (d) => [role(d.role)],
      [AuditActionEnum.Update]: userUpdate,
      [AuditActionEnum.Login]: none,
      [AuditActionEnum.ChangePassword]: none,
      [AuditActionEnum.ResetPassword]: none,
    },
    [AuditEntityEnum.Course]: {
      [AuditActionEnum.Create]: none,
      [AuditActionEnum.Update]: courseUpdate,
      [AuditActionEnum.Delete]: none,
      [AuditActionEnum.Import]: (d) => [
        t(
          d.mode === ImportModeEnum.Update
            ? 'participantImport.modeUpdate'
            : 'participantImport.modeSkip',
        ),
        ...Object.values(ImportRowStatusEnum).map((s) =>
          label(t(`participantImport.groups.${s}`), d[s]),
        ),
      ],
      [AuditActionEnum.Reorder]: (d) => [d.fields.join(', ')],
    },
    [AuditEntityEnum.CourseField]: {
      [AuditActionEnum.Create]: (d) => [
        label(t('courseFields.label'), d.label),
        label(t('courseFields.type'), t(`courseFields.types.${d.type}`)),
        ...(d.required ? [t('courseFields.required')] : []),
      ],
      [AuditActionEnum.Update]: (d) => [
        ...(d.label === undefined
          ? []
          : [label(t('courseFields.label'), d.label)]),
        ...(d.type === undefined
          ? []
          : [label(t('courseFields.type'), t(`courseFields.types.${d.type}`))]),
        ...(d.required === undefined
          ? []
          : [
              label(
                t('courseFields.required'),
                t(d.required ? 'courseFields.yes' : 'courseFields.no'),
              ),
            ]),
      ],
      [AuditActionEnum.Delete]: (d) => [
        label(t('courseFields.label'), d.label),
        t('courseFields.valueCount', { count: d.values }),
      ],
    },
    [AuditEntityEnum.Participant]: {
      [AuditActionEnum.Create]: (d) => [
        label(t('participants.email'), d.email),
      ],
      [AuditActionEnum.Update]: (d) => [
        ...(d.name === undefined ? [] : [label(t('courses.name'), d.name)]),
        ...(d.email === undefined
          ? []
          : [label(t('participants.email'), d.email)]),
        ...(d.fields === undefined
          ? []
          : [label(t('courseFields.title'), d.fields.join(', '))]),
      ],
      [AuditActionEnum.Delete]: (d) => [
        label(t('participants.email'), d.email),
      ],
    },
    [AuditEntityEnum.Font]: {
      [AuditActionEnum.Create]: (d) => [
        t(`auditLog.fontSources.${FontSourceKeys[d.source]}`),
      ],
    },
    [AuditEntityEnum.TemplateVersion]: {
      [AuditActionEnum.Create]: (d) => [
        t('certificates.templateVersion', { version: d.version }),
      ],
      [AuditActionEnum.Update]: (d) => [
        t('certificates.templateVersion', { version: d.version }),
      ],
    },
    [AuditEntityEnum.Certificate]: {
      [AuditActionEnum.Update]: (d) => [
        code(d.code),
        ...(d.name === undefined ? [] : [label(t('courses.name'), d.name)]),
        ...(d.issueDate === undefined
          ? []
          : [label(t('auditLog.detailIssueDate'), day(d.issueDate))]),
      ],
      [AuditActionEnum.Delete]: (d) => [code(d.code)],
      [AuditActionEnum.Revoke]: (d) => [
        code(d.code),
        label(t('certificates.reasonLabel'), d.reason),
      ],
      [AuditActionEnum.Reinstate]: (d) => [code(d.code)],
    },
    [AuditEntityEnum.Job]: {
      [AuditActionEnum.Issue]: (d) =>
        d.retry
          ? [t('auditLog.detailRetry')]
          : [
              label(t('auditLog.detailParticipants'), d.participants),
              label(t('auditLog.detailIssueDate'), day(d.issueDate)),
            ],
      [AuditActionEnum.Regenerate]: (d) =>
        d.retry
          ? [t('auditLog.detailRetry')]
          : [
              label(t('auditLog.detailCertificates'), d.certificates),
              t('certificates.templateVersion', { version: d.templateVersion }),
            ],
    },
  };

  // the server pairs each action with its details, which TS can't correlate here
  const byPair = describers as unknown as Record<
    AuditEntity,
    Record<AuditAction, (details: AuditRecord['details']) => string[]>
  >;
  return (entry) => byPair[entry.entity][entry.action](entry.details);
}

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
  const tableScroll = useTableScroll(t('auditLog.title'), entries);
  const dates = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.language, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
    [i18n.language],
  );
  const describeDetails = useDetailDescriber();

  return (
    <DataTable<AuditEntrySummary>
      records={[...entries]}
      idAccessor="id"
      fetching={loading}
      minHeight={entries.length === 0 ? 200 : undefined}
      highlightOnHover
      verticalSpacing="sm"
      // a visible scrollbar, and keyboard scrolling while it overflows
      {...tableScroll}
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
          accessor: 'userName',
          title: t('auditLog.who'),
          noWrap: true,
          render: (entry) =>
            entry.userId === null ? (
              <Text size="sm" fw={500}>
                {t('auditLog.system')}
              </Text>
            ) : entry.userName === null ? (
              <Text size="sm" fw={500}>
                {t('auditLog.removedUser', { id: entry.userId })}
              </Text>
            ) : (
              <Stack gap={0}>
                <Text size="sm" fw={500}>
                  {entry.userName}
                </Text>
                <Text size="xs" c="dimmed">
                  {entry.userEmail}
                </Text>
              </Stack>
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
              {describeDetails(entry).join(' · ')}
            </Text>
          ),
        },
      ]}
    />
  );
}
