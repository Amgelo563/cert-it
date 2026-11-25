import { type ParticipantSummary, PermissionEnum } from '@cert-it/shared';
import {
  ActionIcon,
  Alert,
  Button,
  Flex,
  Group,
  Menu,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import {
  IconAlertCircle,
  IconChevronDown,
  IconFileImport,
  IconForms,
  IconSearch,
  IconUserPlus,
} from '@tabler/icons-react';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ApiRoutes } from '../../app/api/ApiClient';
import { describeApiError } from '../../app/api/describeApiError';
import { useApiClient } from '../../app/api/useApiClient';
import { useApiRequest } from '../../app/api/useApiRequest';
import { Surface } from '../../app/layout/Surface';
import { usePermissions } from '../../auth/usePermissions';
import { CourseFieldsModal } from '../fields/CourseFieldsModal';
import { useCourse } from '../useCourse';
import { ParticipantFormModal } from './form/ParticipantFormModal';
import { ImportParticipantsModal } from './import/ImportParticipantsModal';
import { ParticipantsTable } from './table/ParticipantsTable';
import { TourTargetEnum } from '../../onboarding/tour/TourTargetEnum';

const PageSize = 25;

const SearchDelayMs = 300;

/** The participants of a course: search them, add, edit and delete them by role. */
export function ParticipantsTab() {
  const { t, i18n } = useTranslation();
  const api = useApiClient();
  const can = usePermissions();
  const { course, reload: reloadCourse, fields, reloadFields } = useCourse();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(search.trim(), SearchDelayMs);
  // undefined while closed, null to add a participant
  const [editing, setEditing] = useState<
    ParticipantSummary | null | undefined
  >();
  // the participant whose change is being sent, so their row can't send another
  const [busyId, setBusyId] = useState<number | null>(null);
  const [importing, setImporting] = useState(false);
  const [managingFields, setManagingFields] = useState(false);

  const participants = useApiRequest(
    useCallback(
      (routes: ApiRoutes) =>
        routes.courses[':courseId'].participants.$get({
          param: { courseId: String(course.id) },
          query: {
            page: String(page),
            size: String(PageSize),
            ...(debouncedSearch ? { search: debouncedSearch } : {}),
          },
        }),
      [course.id, page, debouncedSearch],
    ),
  );

  // the header's count and the fields' value counts change too
  const reloadAll = () => {
    participants.reload();
    reloadCourse();
    reloadFields();
  };

  const remove = (participant: ParticipantSummary) =>
    modals.openConfirmModal({
      title: t('participants.deleteTitle'),
      children: (
        <Text size="sm">
          {t('participants.deleteText', {
            name: participant.name,
            email: participant.email,
          })}
        </Text>
      ),
      labels: { confirm: t('participants.delete'), cancel: t('auth.cancel') },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        setBusyId(participant.id);
        try {
          await api.request((routes) =>
            routes.courses[':courseId'].participants[':id'].$delete({
              param: {
                courseId: String(course.id),
                id: String(participant.id),
              },
            }),
          );
          notifications.show({
            color: 'teal',
            message: t('participants.deleted', { name: participant.name }),
          });
          // the last row of a page leaves the page empty
          if (participants.data?.items.length === 1 && page > 1) {
            setPage(page - 1);
          }
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

  return (
    <Surface p="lg" data-tour={TourTargetEnum.ParticipantsTable}>
      <Stack gap="md">
        <Flex
          justify="space-between"
          align={{ base: 'stretch', sm: 'center' }}
          direction={{ base: 'column', sm: 'row' }}
          gap="sm"
        >
          <Group gap="sm" align="baseline">
            <Text fw={500} size="lg">
              {t('courses.tabs.participants')}
            </Text>
            {participants.data && (
              <Text c="dimmed" size="sm">
                {debouncedSearch
                  ? t('participants.matches', {
                      count: participants.data.total,
                    })
                  : t('participants.count', {
                      count: participants.data.total,
                    })}
              </Text>
            )}
          </Group>
          {can(PermissionEnum.EditParticipants) && (
            <Group gap="sm">
              <Group gap={0} wrap="nowrap">
                <Button
                  variant="default"
                  data-tour={TourTargetEnum.ParticipantsImport}
                  leftSection={<IconFileImport size={16} stroke={1.5} />}
                  onClick={() => setImporting(true)}
                  style={
                    can(PermissionEnum.EditCourses)
                      ? { borderTopRightRadius: 0, borderBottomRightRadius: 0 }
                      : undefined
                  }
                >
                  {t('participantImport.open')}
                </Button>
                {can(PermissionEnum.EditCourses) && (
                  <Menu position="bottom-end" width={200}>
                    <Menu.Target>
                      <ActionIcon
                        variant="default"
                        size={36}
                        aria-label={t('courseFields.manage')}
                        style={{
                          borderTopLeftRadius: 0,
                          borderBottomLeftRadius: 0,
                          borderLeft: 0,
                        }}
                      >
                        <IconChevronDown size={16} stroke={1.5} />
                      </ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown>
                      <Menu.Item
                        leftSection={<IconForms size={16} stroke={1.5} />}
                        onClick={() => setManagingFields(true)}
                      >
                        {t('courseFields.manage')}
                      </Menu.Item>
                    </Menu.Dropdown>
                  </Menu>
                )}
              </Group>
              <Button
                data-tour={TourTargetEnum.ParticipantsAdd}
                leftSection={<IconUserPlus size={16} stroke={1.5} />}
                onClick={() => setEditing(null)}
              >
                {t('participants.add')}
              </Button>
            </Group>
          )}
        </Flex>
        <TextInput
          placeholder={t('participants.searchPlaceholder')}
          aria-label={t('participants.searchPlaceholder')}
          leftSection={<IconSearch size={16} stroke={1.5} />}
          value={search}
          onChange={(event) => {
            setSearch(event.currentTarget.value);
            setPage(1);
          }}
          maw={360}
        />
        {participants.error !== null && (
          <Alert
            color="red"
            variant="light"
            icon={<IconAlertCircle size={18} stroke={1.5} />}
          >
            {describeApiError(participants.error, i18n)}
          </Alert>
        )}
        <ParticipantsTable
          participants={participants.data?.items ?? []}
          total={participants.data?.total ?? 0}
          page={page}
          pageSize={PageSize}
          loading={participants.loading}
          course={course}
          fields={fields}
          emptyText={
            debouncedSearch
              ? t('participants.noMatches')
              : t('participants.empty')
          }
          busyId={busyId}
          onPageChange={setPage}
          onEdit={setEditing}
          onDelete={remove}
        />
      </Stack>

      <CourseFieldsModal
        opened={managingFields}
        courseId={course.id}
        fields={fields}
        onClose={() => setManagingFields(false)}
        onChanged={() => {
          reloadFields();
          participants.reload();
        }}
      />
      <ImportParticipantsModal
        opened={importing}
        course={course}
        fields={fields}
        onFieldsAdded={reloadFields}
        onClose={() => setImporting(false)}
        onImported={reloadAll}
      />
      <ParticipantFormModal
        opened={editing !== undefined}
        course={course}
        fields={fields}
        participant={editing ?? null}
        onClose={() => setEditing(undefined)}
        onSaved={(participant) => {
          notifications.show({
            color: 'teal',
            message: editing
              ? t('participants.saved', { name: participant.name })
              : t('participants.added', { name: participant.name }),
          });
          setEditing(undefined);
          reloadAll();
        }}
      />
    </Surface>
  );
}
