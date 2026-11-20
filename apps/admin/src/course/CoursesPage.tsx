import { LocaleEnum, PermissionEnum } from '@cert-it/shared';
import { Alert, Button, Group, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconAlertCircle, IconPlus } from '@tabler/icons-react';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import type { ApiRoutes } from '../app/api/ApiClient';
import { describeApiError } from '../app/api/describeApiError';
import { useApiRequest } from '../app/api/useApiRequest';
import { readSiteDefaultLocale } from '../app/i18n/readSiteDefaultLocale';
import { PageHeader } from '../app/layout/PageHeader';
import { Surface } from '../app/layout/Surface';
import { usePermissions } from '../auth/usePermissions';
import { AddCourseModal } from './add/AddCourseModal';
import { coursePath } from './CourseTabEnum';
import { CoursesTable } from './table/CoursesTable';

const PageSize = 25;

/** The courses with their counts; each row opens the course's page. */
export function CoursesPage() {
  const { t, i18n } = useTranslation();
  const can = usePermissions();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  const defaultLocale = useMemo(
    () => readSiteDefaultLocale(document) ?? LocaleEnum.En,
    [],
  );

  const courses = useApiRequest(
    useCallback(
      (routes: ApiRoutes) =>
        routes.courses.$get({
          query: { page: String(page), size: String(PageSize) },
        }),
      [page],
    ),
  );

  return (
    <Stack gap="xl">
      <PageHeader
        title={t('courses.title')}
        description={t('courses.description')}
        actions={
          can(PermissionEnum.EditCourses) && (
            <Button
              leftSection={<IconPlus size={16} stroke={1.5} />}
              onClick={() => setAdding(true)}
            >
              {t('courses.add')}
            </Button>
          )
        }
      />

      <Surface p="lg">
        <Stack gap="md">
          <Group justify="space-between">
            <Text fw={500} size="lg">
              {t('courses.listTitle')}
            </Text>
            {courses.data && (
              <Text c="dimmed" size="sm">
                {t('courses.count', { count: courses.data.total })}
              </Text>
            )}
          </Group>
          {courses.error !== null && (
            <Alert
              color="red"
              variant="light"
              icon={<IconAlertCircle size={18} stroke={1.5} />}
            >
              {describeApiError(courses.error, i18n)}
            </Alert>
          )}
          <CoursesTable
            courses={courses.data?.items ?? []}
            total={courses.data?.total ?? 0}
            page={page}
            pageSize={PageSize}
            loading={courses.loading}
            onPageChange={setPage}
          />
        </Stack>
      </Surface>

      <AddCourseModal
        opened={adding}
        defaultLocale={defaultLocale}
        onClose={() => setAdding(false)}
        onCreated={(course) => {
          notifications.show({
            color: 'teal',
            message: t('courses.added', { name: course.name }),
          });
          void navigate(coursePath(course.id));
        }}
      />
    </Stack>
  );
}
