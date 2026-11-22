import {
  type JobSummary,
  type ParticipantCertificateFilter,
  ParticipantCertificateFilterEnum,
  type ParticipantSummary,
  PermissionEnum,
} from '@cert-it/shared';
import {
  Alert,
  Button,
  Flex,
  Group,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
  useMatches,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import {
  IconAlertCircle,
  IconCertificate,
  IconSearch,
} from '@tabler/icons-react';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ApiRoutes } from '../../app/api/ApiClient';
import { describeApiError } from '../../app/api/describeApiError';
import { useApiClient } from '../../app/api/useApiClient';
import { useApiRequest } from '../../app/api/useApiRequest';
import { Surface } from '../../app/layout/Surface';
import { StatusLabel } from '../../app/layout/StatusLabel';
import { usePermissions } from '../../auth/usePermissions';
import { useCourse } from '../useCourse';
import { IssueCertificatesModal } from './issue/IssueCertificatesModal';
import { CertificateJobPanel } from './job/CertificateJobPanel';
import { isJobActive } from './job/isJobActive';
import { useCertificateJob } from './job/useCertificateJob';
import { EditCertificateModal } from './edit/EditCertificateModal';
import { CertificateExportMenu } from './export/CertificateExportMenu';
import { RegenerateCertificatesModal } from './regenerate/RegenerateCertificatesModal';
import { useOutdatedCertificates } from './regenerate/useOutdatedCertificates';
import { RevokeCertificateModal } from './revoke/RevokeCertificateModal';
import { CertificatesTable } from './table/CertificatesTable';

const PageSize = 25;

const SearchDelayMs = 300;

const AllFilter = 'all';

type Filter = ParticipantCertificateFilter | typeof AllFilter;

const Filters: readonly Filter[] = [
  AllFilter,
  ...Object.values(ParticipantCertificateFilterEnum),
];

/** A course's certificates: issue them to everyone without one or to checked participants, follow the job, and revoke or reinstate them. */
export function CertificatesTab() {
  const { t, i18n } = useTranslation();
  const api = useApiClient();
  const can = usePermissions();
  const canIssue = can(PermissionEnum.IssueCertificates);
  const { course, reload: reloadCourse } = useCourse();
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<Filter>(AllFilter);
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(search.trim(), SearchDelayMs);
  const [selected, setSelected] = useState<ParticipantSummary[]>([]);
  // undefined while closed, null for everyone without a certificate
  const [issuing, setIssuing] = useState<
    readonly number[] | null | undefined
  >();
  const [revoking, setRevoking] = useState<ParticipantSummary | null>(null);
  const [editing, setEditing] = useState<ParticipantSummary | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  // four options don't fit a phone at the default size
  const compactFilter = useMatches({ base: true, sm: false });
  const [busyId, setBusyId] = useState<number | null>(null);

  const participants = useApiRequest(
    useCallback(
      (routes: ApiRoutes) =>
        routes.courses[':courseId'].participants.$get({
          param: { courseId: String(course.id) },
          query: {
            page: String(page),
            size: String(PageSize),
            ...(debouncedSearch ? { search: debouncedSearch } : {}),
            ...(filter === AllFilter ? {} : { certificate: filter }),
          },
        }),
      [course.id, page, debouncedSearch, filter],
    ),
  );

  const outdated = useOutdatedCertificates(course.id);

  // the header's counts and the outdated ones change too
  const reloadList = participants.reload;
  const reloadOutdated = outdated.reload;
  const reloadAll = useCallback(() => {
    reloadList();
    reloadOutdated();
    reloadCourse();
  }, [reloadList, reloadOutdated, reloadCourse]);

  const job = useCertificateJob(course.id, reloadAll);
  const running = job.job !== null && isJobActive(job.job);
  const { certificateCounts } = course;
  const withoutCertificate =
    course.participantCount
    - certificateCounts.active
    - certificateCounts.revoked;
  const hasTemplate = course.latestTemplateVersion !== null;
  const issuedCount = certificateCounts.active + certificateCounts.revoked;

  const followJob = (added: JobSummary, message: string) => {
    notifications.show({ color: 'teal', message });
    job.follow(added);
  };

  // asks first, then sends the change for the participant's certificate
  const confirmChange = (
    participant: ParticipantSummary,
    options: {
      action: 'reinstate' | 'delete';
      send: (param: { courseId: string; id: string }) => Promise<unknown>;
    },
  ) => {
    const certificate = participant.certificate;
    if (!certificate) return;
    const { action, send } = options;
    const destructive = action === 'delete';
    modals.openConfirmModal({
      title: t(`certificates.${action}Title`),
      children: (
        <Text size="sm">
          {t(`certificates.${action}Text`, {
            name: participant.name,
            code: certificate.code,
          })}
        </Text>
      ),
      labels: {
        confirm: t(`certificates.${action}`),
        cancel: t('auth.cancel'),
      },
      confirmProps: destructive ? { color: 'red' } : undefined,
      onConfirm: async () => {
        setBusyId(participant.id);
        try {
          await send({
            courseId: String(course.id),
            id: String(certificate.id),
          });
          notifications.show({
            color: 'teal',
            message: t(
              destructive
                ? 'certificates.deletedNotice'
                : 'certificates.reinstatedNotice',
              { name: participant.name },
            ),
          });
          reloadAll();
        } catch (error) {
          notifications.show({
            color: 'red',
            message: describeApiError(error, i18n),
          });
        } finally {
          setBusyId(null);
        }
      },
    });
  };

  const reinstate = (participant: ParticipantSummary) =>
    confirmChange(participant, {
      action: 'reinstate',
      send: (param) =>
        api.request((routes) =>
          routes.courses[':courseId'].certificates[':id'].reinstate.$post({
            param,
          }),
        ),
    });

  const remove = (participant: ParticipantSummary) =>
    confirmChange(participant, {
      action: 'delete',
      send: (param) =>
        api.request((routes) =>
          routes.courses[':courseId'].certificates[':id'].$delete({ param }),
        ),
    });

  const outdatedCount = outdated.data?.items.length ?? 0;

  const issued = (added: JobSummary) => {
    setIssuing(undefined);
    setSelected([]);
    followJob(added, t('certificates.issueStarted', { count: added.total }));
  };

  return (
    <Stack gap="xl">
      {job.job && (
        <CertificateJobPanel
          job={job.job}
          canRetry={canIssue}
          onRetry={() =>
            job.retry().catch((error: unknown) => {
              notifications.show({
                color: 'red',
                message: describeApiError(error, i18n),
              });
            })
          }
          onDismiss={job.dismiss}
        />
      )}

      {/* hidden while a job runs, which may be the regeneration itself */}
      {canIssue && outdatedCount > 0 && !running && (
        <Surface p="lg">
          <Group justify="space-between" gap="sm">
            <StatusLabel color="orange">
              {t('certificates.outdatedNotice', { count: outdatedCount })}
            </StatusLabel>
            <Button
              size="xs"
              variant="light"
              onClick={() => setRegenerating(true)}
            >
              {t('certificates.outdatedReview')}
            </Button>
          </Group>
        </Surface>
      )}

      <Surface p="lg">
        <Stack gap="md">
          <Flex
            justify="space-between"
            align={{ base: 'stretch', sm: 'center' }}
            direction={{ base: 'column', sm: 'row' }}
            gap="sm"
          >
            <Group gap="sm" align="baseline">
              <Text fw={500} size="lg">
                {t('courses.tabs.certificates')}
              </Text>
              {participants.data && (
                <Text c="dimmed" size="sm">
                  {t('certificates.count', { count: participants.data.total })}
                </Text>
              )}
            </Group>
            {canIssue && (hasTemplate || issuedCount > 0) && (
              <Group gap="sm">
                {issuedCount > 0 && selected.length === 0 && (
                  <CertificateExportMenu
                    courseId={course.id}
                    activeCount={certificateCounts.active}
                  />
                )}
                {!hasTemplate ? null : selected.length > 0 ? (
                  <>
                    <Button
                      variant="subtle"
                      color="gray"
                      onClick={() => setSelected([])}
                    >
                      {t('certificates.clearSelection')}
                    </Button>
                    <Button
                      leftSection={<IconCertificate size={16} stroke={1.5} />}
                      disabled={running}
                      onClick={() => setIssuing(selected.map(({ id }) => id))}
                    >
                      {t('certificates.issueSelected', {
                        count: selected.length,
                      })}
                    </Button>
                  </>
                ) : (
                  <Button
                    leftSection={<IconCertificate size={16} stroke={1.5} />}
                    disabled={running || withoutCertificate === 0}
                    onClick={() => setIssuing(null)}
                  >
                    {t('certificates.issueAll')}
                  </Button>
                )}
              </Group>
            )}
          </Flex>

          {canIssue && !hasTemplate && (
            <Alert
              color="orange"
              variant="light"
              icon={<IconAlertCircle size={18} stroke={1.5} />}
            >
              {t('certificates.noTemplate')}
            </Alert>
          )}

          {/* the filter moves under the search when both don't fit */}
          <Group gap="sm" wrap="wrap">
            <TextInput
              placeholder={t('certificates.searchPlaceholder')}
              aria-label={t('certificates.searchPlaceholder')}
              leftSection={<IconSearch size={16} stroke={1.5} />}
              value={search}
              onChange={(event) => {
                setSearch(event.currentTarget.value);
                setPage(1);
              }}
              flex="1 1 240px"
              maw={360}
            />
            <SegmentedControl
              aria-label={t('certificates.filterLabel')}
              size={compactFilter ? 'xs' : 'sm'}
              fullWidth={compactFilter}
              w={compactFilter ? '100%' : undefined}
              value={filter}
              onChange={(value) => {
                setFilter(value as Filter);
                setPage(1);
              }}
              data={Filters.map((value) => ({
                value,
                label: t(`certificates.filters.${value}`),
              }))}
            />
          </Group>

          {participants.error !== null && (
            <Alert
              color="red"
              variant="light"
              icon={<IconAlertCircle size={18} stroke={1.5} />}
            >
              {describeApiError(participants.error, i18n)}
            </Alert>
          )}

          <CertificatesTable
            participants={participants.data?.items ?? []}
            total={participants.data?.total ?? 0}
            page={page}
            pageSize={PageSize}
            loading={participants.loading}
            latestTemplateVersion={course.latestTemplateVersion}
            emptyText={
              debouncedSearch
                ? t('certificates.noMatches')
                : t('certificates.empty')
            }
            selected={canIssue && hasTemplate ? selected : null}
            onSelectedChange={setSelected}
            busyId={busyId}
            onPageChange={setPage}
            onEdit={setEditing}
            onRevoke={setRevoking}
            onReinstate={reinstate}
            onDelete={remove}
          />
        </Stack>
      </Surface>

      <IssueCertificatesModal
        opened={issuing !== undefined}
        courseId={course.id}
        participantIds={issuing ?? null}
        count={issuing ? issuing.length : withoutCertificate}
        onClose={() => setIssuing(undefined)}
        onIssued={issued}
      />
      <RevokeCertificateModal
        courseId={course.id}
        participant={revoking}
        onClose={() => setRevoking(null)}
        onRevoked={() => {
          notifications.show({
            color: 'teal',
            message: t('certificates.revokedNotice', {
              name: revoking?.name ?? '',
            }),
          });
          setRevoking(null);
          reloadAll();
        }}
      />
      <EditCertificateModal
        courseId={course.id}
        participant={editing}
        onClose={() => setEditing(null)}
        onSaved={(added) => {
          followJob(
            added,
            t('certificates.editStarted', { name: editing?.name ?? '' }),
          );
          setEditing(null);
          reloadList();
        }}
      />
      {outdated.data && (
        <RegenerateCertificatesModal
          opened={regenerating}
          courseId={course.id}
          outdated={outdated.data}
          onClose={() => setRegenerating(false)}
          onRegenerated={(added) => {
            followJob(added, t('regenerate.started', { count: added.total }));
            setRegenerating(false);
          }}
        />
      )}
    </Stack>
  );
}
