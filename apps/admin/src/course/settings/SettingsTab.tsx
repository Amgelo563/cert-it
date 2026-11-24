import { PermissionEnum } from '@cert-it/shared';
import { Alert, Box, Button, Flex, Group, Stack, Text } from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import {
  IconAlertCircle,
  IconArchive,
  IconArchiveOff,
  IconTrash,
} from '@tabler/icons-react';
import { type ReactNode, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { describeApiError } from '../../app/api/describeApiError';
import { useApiClient } from '../../app/api/useApiClient';
import { Surface } from '../../app/layout/Surface';
import { AdminPathEnum } from '../../app/router/AdminPathEnum';
import { LeaveGuard } from '../../app/router/LeaveGuard';
import { usePermissions } from '../../auth/usePermissions';
import { CourseFormFields } from '../form/CourseFormFields';
import { courseFormValues, useCourseForm } from '../form/useCourseForm';
import { useCourse } from '../useCourse';

type SettingsSectionProps = {
  title: string;
  description: string;
  action: ReactNode;
};

// a title and text on the left, its one action on the right
function SettingsSection({ title, description, action }: SettingsSectionProps) {
  return (
    <Surface p="lg">
      <Flex
        justify="space-between"
        align={{ base: 'flex-start', sm: 'center' }}
        direction={{ base: 'column', sm: 'row' }}
        gap="md"
      >
        <Stack gap={4} maw={560}>
          <Text fw={500}>{title}</Text>
          <Text c="dimmed" size="sm">
            {description}
          </Text>
        </Stack>
        <Box flex="none">{action}</Box>
      </Flex>
    </Surface>
  );
}

/** A course's fields, and archiving or deleting it. */
export function SettingsTab() {
  const { t, i18n } = useTranslation();
  const api = useApiClient();
  const can = usePermissions();
  const navigate = useNavigate();
  const { course, reload } = useCourse();
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState<'save' | 'archive' | 'delete' | null>(null);
  const form = useCourseForm(courseFormValues(course, course.locale));

  // the saved values become the new baseline, so the form isn't dirty
  useEffect(() => {
    const values = courseFormValues(course, course.locale);
    form.setValues(values);
    form.resetDirty(values);
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- form is stable
  }, [course]);

  const save = form.onSubmit(async (json) => {
    setBusy('save');
    setError(null);
    try {
      const saved = await api.request((routes) =>
        routes.courses[':id'].$patch({
          param: { id: String(course.id) },
          json,
        }),
      );
      notifications.show({
        color: 'teal',
        message: t('courses.saved', { name: saved.name }),
      });
      reload();
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(null);
    }
  });

  const setActive = async (active: boolean) => {
    setBusy('archive');
    try {
      await api.request((routes) =>
        routes.courses[':id'].$patch({
          param: { id: String(course.id) },
          json: { active },
        }),
      );
      notifications.show({
        color: 'teal',
        message: active
          ? t('courses.unarchivedNotice', { name: course.name })
          : t('courses.archivedNotice', { name: course.name }),
      });
      reload();
    } catch (caught) {
      notifications.show({
        color: 'red',
        message: describeApiError(caught, i18n),
      });
    } finally {
      setBusy(null);
    }
  };

  // unarchiving hides nothing, so it needs no confirmation
  const toggleArchive = () => {
    if (!course.active) return void setActive(true);
    modals.openConfirmModal({
      title: t('courses.archiveTitle'),
      children: (
        <Text size="sm">{t('courses.archiveText', { name: course.name })}</Text>
      ),
      labels: { confirm: t('courses.archive'), cancel: t('auth.cancel') },
      onConfirm: () => void setActive(false),
    });
  };

  const remove = () =>
    modals.openConfirmModal({
      title: t('courses.deleteTitle'),
      children: (
        <Text size="sm">
          {t('courses.deleteText', {
            name: course.name,
            participants: course.participantCount,
            certificates:
              course.certificateCounts.active
              + course.certificateCounts.revoked,
          })}
        </Text>
      ),
      labels: { confirm: t('courses.delete'), cancel: t('auth.cancel') },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        setBusy('delete');
        try {
          await api.request((routes) =>
            routes.courses[':id'].$delete({
              param: { id: String(course.id) },
            }),
          );
          notifications.show({
            color: 'teal',
            message: t('courses.deleted', { name: course.name }),
          });
          void navigate(AdminPathEnum.Courses);
        } catch (caught) {
          notifications.show({
            color: 'red',
            message: describeApiError(caught, i18n),
          });
          setBusy(null);
        }
      },
    });

  return (
    <Stack gap="lg">
      {/* a deleted course has nothing left to lose */}
      <LeaveGuard when={form.isDirty() && busy !== 'delete'} />
      <Surface p="lg">
        <form onSubmit={save} noValidate>
          <Stack gap="md">
            <Text fw={500} size="lg">
              {t('courses.generalTitle')}
            </Text>
            {error !== null && (
              <Alert
                color="red"
                variant="light"
                icon={<IconAlertCircle size={18} stroke={1.5} />}
              >
                {describeApiError(error, i18n)}
              </Alert>
            )}
            <Stack maw={560}>
              <CourseFormFields form={form} />
            </Stack>
            <Group gap="sm">
              <Button
                type="submit"
                loading={busy === 'save'}
                disabled={!form.isDirty()}
              >
                {t('courses.saveSubmit')}
              </Button>
              {form.isDirty() && (
                <Button
                  variant="subtle"
                  color="gray"
                  onClick={() => form.reset()}
                >
                  {t('courses.discard')}
                </Button>
              )}
            </Group>
          </Stack>
        </form>
      </Surface>

      <SettingsSection
        title={
          course.active ? t('courses.archiveSection') : t('courses.archived')
        }
        description={
          course.active
            ? t('courses.archiveSectionText')
            : t('courses.unarchiveSectionText')
        }
        action={
          <Button
            variant="default"
            loading={busy === 'archive'}
            leftSection={
              course.active ? (
                <IconArchive size={16} stroke={1.5} />
              ) : (
                <IconArchiveOff size={16} stroke={1.5} />
              )
            }
            onClick={toggleArchive}
          >
            {course.active ? t('courses.archive') : t('courses.unarchive')}
          </Button>
        }
      />

      {can(PermissionEnum.DeleteRecords) && (
        <SettingsSection
          title={t('courses.deleteSection')}
          description={t('courses.deleteSectionText')}
          action={
            <Button
              color="red"
              variant="light"
              loading={busy === 'delete'}
              leftSection={<IconTrash size={16} stroke={1.5} />}
              onClick={remove}
            >
              {t('courses.delete')}
            </Button>
          }
        />
      )}
    </Stack>
  );
}
