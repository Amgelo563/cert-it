import {
  CertificateStatusEnum,
  type ParticipantSummary,
  PermissionEnum,
} from '@cert-it/shared';
import { ActionIcon, Group, Menu, Stack, Text, Tooltip } from '@mantine/core';
import {
  IconArrowBackUp,
  IconBan,
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
import { certificateFileUrl } from '../../participants/certificateFileUrl';

type CertificatesTableProps = {
  participants: readonly ParticipantSummary[];
  total: number;
  page: number;
  pageSize: number;
  loading: boolean;
  /** Newest template version of the course, to point out older certificates. */
  latestTemplateVersion: number | null;
  /** Shown when there are no rows, such as for a search without matches. */
  emptyText: string;
  /** Checked participants, kept across pages; null hides the checkboxes. */
  selected: readonly ParticipantSummary[] | null;
  onSelectedChange: (selected: ParticipantSummary[]) => void;
  /** The participant whose change is being sent, whose menu is disabled meanwhile. */
  busyId: number | null;
  onPageChange: (page: number) => void;
  onEdit: (participant: ParticipantSummary) => void;
  onRevoke: (participant: ParticipantSummary) => void;
  onReinstate: (participant: ParticipantSummary) => void;
  onDelete: (participant: ParticipantSummary) => void;
};

/** One page of a course's participants with their certificates; rows without one can be checked to issue. */
export function CertificatesTable({
  participants,
  total,
  page,
  pageSize,
  loading,
  latestTemplateVersion,
  emptyText,
  selected,
  onSelectedChange,
  busyId,
  onPageChange,
  onEdit,
  onRevoke,
  onReinstate,
  onDelete,
}: CertificatesTableProps) {
  const { t, i18n } = useTranslation();
  const can = usePermissions();
  const canEdit = can(PermissionEnum.IssueCertificates);
  const canRevoke = can(PermissionEnum.RevokeCertificates);
  const canDelete = can(PermissionEnum.DeleteRecords);

  // issue dates are calendar days, so they are read as UTC
  const dates = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.language, {
        dateStyle: 'medium',
        timeZone: 'UTC',
      }),
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
      {...(selected
        ? {
            selectedRecords: [...selected],
            onSelectedRecordsChange: onSelectedChange,
            isRecordSelectable: (participant: ParticipantSummary) =>
              participant.certificate === null,
            allRecordsSelectionCheckboxProps: {
              'aria-label': t('certificates.selectAll'),
            },
            getRecordSelectionCheckboxProps: (
              participant: ParticipantSummary,
            ) => ({
              'aria-label': t('certificates.select', {
                name: participant.name,
              }),
            }),
          }
        : {})}
      columns={[
        {
          accessor: 'name',
          title: t('certificates.participant'),
          render: (participant) => (
            <Stack gap={4}>
              <Text size="sm" fw={500}>
                {participant.name}
              </Text>
              <Text size="xs" c="dimmed">
                {participant.email}
              </Text>
            </Stack>
          ),
        },
        {
          accessor: 'certificate',
          title: t('certificates.certificate'),
          render: ({ certificate }) => {
            if (!certificate) {
              return (
                <Text size="sm" c="dimmed">
                  {t('certificates.notIssued')}
                </Text>
              );
            }
            const active = certificate.status === CertificateStatusEnum.Active;
            const outdated =
              latestTemplateVersion !== null
              && certificate.templateVersion < latestTemplateVersion;
            return (
              <Stack gap={4}>
                <Group gap="sm" wrap="nowrap">
                  <StatusLabel color={active ? 'teal' : 'red'}>
                    {active
                      ? t('certificates.active')
                      : t('certificates.revoked')}
                  </StatusLabel>
                  <MonoFigure>{certificate.code}</MonoFigure>
                </Group>
                {certificate.revokedReason !== null ? (
                  <Text size="xs" c="dimmed" lineClamp={2}>
                    {t('certificates.revokedReason', {
                      reason: certificate.revokedReason,
                    })}
                  </Text>
                ) : (
                  <Text size="xs" c="dimmed">
                    {outdated
                      ? t('certificates.olderTemplate', {
                          version: certificate.templateVersion,
                          latest: latestTemplateVersion,
                        })
                      : t('certificates.templateVersion', {
                          version: certificate.templateVersion,
                        })}
                  </Text>
                )}
              </Stack>
            );
          },
        },
        {
          accessor: 'issueDate',
          title: t('certificates.issueDate'),
          noWrap: true,
          render: ({ certificate }) =>
            certificate ? (
              <MonoFigure>
                {dates.format(new Date(`${certificate.issueDate}T00:00:00Z`))}
              </MonoFigure>
            ) : null,
        },
        {
          accessor: 'actions',
          title: '',
          textAlign: 'right',
          width: 96,
          render: (participant) => {
            const { certificate } = participant;
            if (!certificate) return null;
            const active = certificate.status === CertificateStatusEnum.Active;
            return (
              <Group justify="flex-end" gap={4} wrap="nowrap">
                {/* revoked certificates serve no PDF */}
                {active && (
                  <Tooltip label={t('certificates.openPdf')}>
                    <ActionIcon
                      component="a"
                      href={certificateFileUrl(certificate.code)}
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
                {(canEdit || canRevoke || canDelete) && (
                  <Menu position="bottom-end" width={200}>
                    <Menu.Target>
                      <ActionIcon
                        disabled={participant.id === busyId}
                        aria-label={t('certificates.actions', {
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
                          {t('certificates.edit')}
                        </Menu.Item>
                      )}
                      {canRevoke
                        && (active ? (
                          <Menu.Item
                            color="red"
                            leftSection={<IconBan size={16} stroke={1.5} />}
                            onClick={() => onRevoke(participant)}
                          >
                            {t('certificates.revoke')}
                          </Menu.Item>
                        ) : (
                          <Menu.Item
                            leftSection={
                              <IconArrowBackUp size={16} stroke={1.5} />
                            }
                            onClick={() => onReinstate(participant)}
                          >
                            {t('certificates.reinstate')}
                          </Menu.Item>
                        ))}
                      {canDelete && (
                        <Menu.Item
                          color="red"
                          leftSection={<IconTrash size={16} stroke={1.5} />}
                          onClick={() => onDelete(participant)}
                        >
                          {t('certificates.delete')}
                        </Menu.Item>
                      )}
                    </Menu.Dropdown>
                  </Menu>
                )}
              </Group>
            );
          },
        },
      ]}
    />
  );
}
