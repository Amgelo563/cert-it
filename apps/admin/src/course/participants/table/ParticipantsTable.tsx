import {
  CertificateStatusEnum,
  type CourseFieldSummary,
  type CourseSummary,
  type ParticipantSummary,
  PermissionEnum,
} from '@cert-it/shared';
import { ActionIcon, Group, Menu, Stack, Text, Tooltip } from '@mantine/core';
import {
  IconDots,
  IconExternalLink,
  IconPencil,
  IconTrash,
} from '@tabler/icons-react';
import { type DataTableColumn, DataTable } from 'mantine-datatable';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useTableScroll } from '../../../app/layout/useTableScroll';
import { MonoFigure } from '../../../app/layout/MonoFigure';
import { StatusLabel } from '../../../app/layout/StatusLabel';
import { usePermissions } from '../../../auth/usePermissions';
import { FieldValueView } from '../../fields/FieldValueView';
import { certificateFileUrl } from '../certificateFileUrl';

type ParticipantsTableProps = {
  participants: readonly ParticipantSummary[];
  total: number;
  page: number;
  pageSize: number;
  loading: boolean;
  /** The course, for its newest template version and how its values are shown. */
  course: Pick<
    CourseSummary,
    'id' | 'locale' | 'dateFormat' | 'latestTemplateVersion'
  >;
  /** The course's fields, one column each. */
  fields: readonly CourseFieldSummary[];
  /** Shown when there are no rows, such as for a search without matches. */
  emptyText: string;
  /** The participant whose change is being sent, whose menu is disabled meanwhile. */
  busyId: number | null;
  onPageChange: (page: number) => void;
  onEdit: (participant: ParticipantSummary) => void;
  onDelete: (participant: ParticipantSummary) => void;
};

/** One page of a course's participants, with the actions the user's role allows. */
export function ParticipantsTable({
  participants,
  total,
  page,
  pageSize,
  loading,
  course,
  fields,
  emptyText,
  busyId,
  onPageChange,
  onEdit,
  onDelete,
}: ParticipantsTableProps) {
  const { t, i18n } = useTranslation();
  const tableScroll = useTableScroll(
    t('courses.tabs.participants'),
    participants,
  );
  const can = usePermissions();
  const canEdit = can(PermissionEnum.EditParticipants);
  const canDelete = can(PermissionEnum.DeleteRecords);
  const { latestTemplateVersion } = course;
  // with field columns the table scrolls, so the email goes under the pinned name
  const withFields = fields.length > 0;
  const fieldColumns = fields.map(
    (field): DataTableColumn<ParticipantSummary> => ({
      accessor: `field-${field.id}`,
      title: field.label,
      render: (participant) => (
        <FieldValueView
          field={field}
          course={course}
          value={participant.fieldValues[String(field.id)]}
        />
      ),
    }),
  );

  const dates = useMemo(
    () => new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }),
    [i18n.language],
  );

  return (
    <DataTable<ParticipantSummary>
      records={[...participants]}
      idAccessor="id"
      fetching={loading}
      minHeight={participants.length === 0 ? 200 : undefined}
      highlightOnHover
      verticalSpacing="sm"
      // a visible scrollbar, and keyboard scrolling while it overflows
      {...tableScroll}
      pinLastColumn
      pinFirstColumn={withFields}
      noRecordsText={emptyText}
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
          accessor: 'name',
          title: t('participants.name'),
          render: (participant) => (
            <Stack gap={4}>
              <Text size="sm" fw={500}>
                {participant.name}
              </Text>
              {withFields && (
                <Text size="xs" c="dimmed">
                  {participant.email}
                </Text>
              )}
            </Stack>
          ),
        },
        ...(withFields
          ? []
          : [
              {
                accessor: 'email',
                title: t('participants.email'),
                noWrap: true,
                render: (participant: ParticipantSummary) => (
                  <Text size="sm">{participant.email}</Text>
                ),
              },
            ]),
        ...fieldColumns,
        {
          accessor: 'certificate',
          title: t('participants.certificate'),
          noWrap: true,
          render: ({ certificate }) => {
            if (!certificate) {
              return (
                <Text size="sm" c="dimmed">
                  {t('participants.notIssued')}
                </Text>
              );
            }
            const { templateVersion } = certificate;
            const outdated =
              latestTemplateVersion !== null
              && templateVersion < latestTemplateVersion;
            return (
              <Stack gap={4}>
                {certificate.status === CertificateStatusEnum.Active ? (
                  <StatusLabel color="teal">
                    {t('participants.certificateActive')}
                  </StatusLabel>
                ) : (
                  <StatusLabel color="red">
                    {t('participants.certificateRevoked')}
                  </StatusLabel>
                )}
                <Text size="xs" c="dimmed">
                  {outdated
                    ? t('participants.olderTemplate', {
                        version: templateVersion,
                        latest: latestTemplateVersion,
                      })
                    : t('participants.templateVersion', {
                        version: templateVersion,
                      })}
                </Text>
              </Stack>
            );
          },
        },
        {
          accessor: 'createdAt',
          title: t('participants.addedAt'),
          noWrap: true,
          render: (participant) => (
            <MonoFigure>
              {dates.format(new Date(participant.createdAt))}
            </MonoFigure>
          ),
        },
        {
          accessor: 'actions',
          title: '',
          textAlign: 'right',
          width: 96,
          render: (participant) => (
            <Group justify="flex-end" gap={4} wrap="nowrap">
              {/* revoked certificates serve no PDF */}
              {participant.certificate?.status
                === CertificateStatusEnum.Active && (
                <Tooltip label={t('participants.openCertificate')}>
                  <ActionIcon
                    component="a"
                    href={certificateFileUrl(participant.certificate.code)}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={t('participants.openCertificateOf', {
                      name: participant.name,
                    })}
                  >
                    <IconExternalLink size={18} stroke={1.5} />
                  </ActionIcon>
                </Tooltip>
              )}
              {(canEdit || canDelete) && (
                <Menu position="bottom-end" width={200}>
                  <Menu.Target>
                    <ActionIcon
                      disabled={participant.id === busyId}
                      aria-label={t('participants.actions', {
                        name: participant.name,
                      })}
                    >
                      <IconDots size={18} stroke={1.5} />
                    </ActionIcon>
                  </Menu.Target>
                  <Menu.Dropdown>
                    {canEdit && (
                      <Menu.Item
                        leftSection={<IconPencil size={16} stroke={1.5} />}
                        onClick={() => onEdit(participant)}
                      >
                        {t('participants.edit')}
                      </Menu.Item>
                    )}
                    {canDelete && (
                      <Menu.Item
                        color="red"
                        leftSection={<IconTrash size={16} stroke={1.5} />}
                        onClick={() => onDelete(participant)}
                      >
                        {t('participants.delete')}
                      </Menu.Item>
                    )}
                  </Menu.Dropdown>
                </Menu>
              )}
            </Group>
          ),
        },
      ]}
    />
  );
}
