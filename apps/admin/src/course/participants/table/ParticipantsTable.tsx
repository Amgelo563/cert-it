import {
  CertificateStatusEnum,
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
import { DataTable } from 'mantine-datatable';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { MonoFigure } from '../../../app/layout/MonoFigure';
import { StatusLabel } from '../../../app/layout/StatusLabel';
import { usePermissions } from '../../../auth/usePermissions';
import { certificateFileUrl } from '../certificateFileUrl';

type ParticipantsTableProps = {
  participants: readonly ParticipantSummary[];
  total: number;
  page: number;
  pageSize: number;
  loading: boolean;
  /** Newest template version of the course, to point out older certificates. */
  latestTemplateVersion: number | null;
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
  latestTemplateVersion,
  emptyText,
  busyId,
  onPageChange,
  onEdit,
  onDelete,
}: ParticipantsTableProps) {
  const { t, i18n } = useTranslation();
  const can = usePermissions();
  const canEdit = can(PermissionEnum.EditParticipants);
  const canDelete = can(PermissionEnum.DeleteRecords);

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
          render: (participant) => {
            const extra = Object.entries(participant.extra);
            return (
              <Stack gap={2}>
                <Text size="sm" fw={500}>
                  {participant.name}
                </Text>
                {extra.length > 0 && (
                  <Text size="xs" c="dimmed">
                    {extra
                      .map(([key, value]) => `${key}: ${value}`)
                      .join(' · ')}
                  </Text>
                )}
              </Stack>
            );
          },
        },
        {
          accessor: 'email',
          title: t('participants.email'),
          noWrap: true,
          render: (participant) => <Text size="sm">{participant.email}</Text>,
        },
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
              <Stack gap={2}>
                {certificate.status === CertificateStatusEnum.Active ? (
                  <StatusLabel color="teal">
                    {t('participants.certificateActive')}
                  </StatusLabel>
                ) : (
                  <StatusLabel color="red">
                    {t('participants.certificateRevoked')}
                  </StatusLabel>
                )}
                <Text size="xs" c={outdated ? 'orange' : 'dimmed'}>
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
