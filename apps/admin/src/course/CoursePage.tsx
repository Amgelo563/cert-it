import { ApiErrorCodeEnum, PermissionEnum } from '@cert-it/shared';
import { Alert, Anchor, Group, Stack, Tabs, Text } from '@mantine/core';
import {
  IconAlertCircle,
  IconArrowLeft,
  IconCertificate,
  IconSettings,
  IconTemplate,
  IconUsers,
} from '@tabler/icons-react';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Link,
  Outlet,
  useLocation,
  useHref,
  useNavigate,
  useNavigation,
  useParams,
} from 'react-router';
import type { ApiRoutes } from '../app/api/ApiClient';
import { describeApiError } from '../app/api/describeApiError';
import { ApiRequestError } from '../app/api/errors/ApiRequestError';
import { useApiRequest } from '../app/api/useApiRequest';
import { NotFoundPage } from '../app/error/NotFoundPage';
import { useLocaleNames } from '../app/i18n/useLocaleNames';
import { MonoFigure } from '../app/layout/MonoFigure';
import { PageHeader } from '../app/layout/PageHeader';
import { PageLoader } from '../app/layout/PageLoader';
import { StatusLabel } from '../app/layout/StatusLabel';
import { AdminPathEnum } from '../app/router/AdminPathEnum';
import { usePermissions } from '../auth/usePermissions';
import { type CourseTab, CourseTabEnum, coursePath } from './CourseTabEnum';
import type { CourseContext } from './useCourse';

/** A course's page: its name, counts and status, with a tab for each part of it. */
export function CoursePage() {
  const { t, i18n } = useTranslation();
  const can = usePermissions();
  const localeNames = useLocaleNames();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const navigation = useNavigation();
  const courseId = useParams()['courseId'] ?? '';
  const courseHref = useHref(
    AdminPathEnum.Course.replace(':courseId', courseId),
  );

  const request = useApiRequest(
    useCallback(
      (routes: ApiRoutes) =>
        routes.courses[':id'].$get({ param: { id: courseId } }),
      [courseId],
    ),
  );
  // the last answer may be for the course before a link to another
  const course =
    request.data && String(request.data.id) === courseId ? request.data : null;
  const context = useMemo<CourseContext | null>(
    () => (course ? { course, reload: request.reload } : null),
    [course, request.reload],
  );
  const numbers = useMemo(
    () => new Intl.NumberFormat(i18n.language),
    [i18n.language],
  );

  const tabs = [
    { value: CourseTabEnum.Participants, icon: IconUsers, show: true },
    { value: CourseTabEnum.Certificates, icon: IconCertificate, show: true },
    {
      value: CourseTabEnum.Template,
      icon: IconTemplate,
      show: can(PermissionEnum.EditCourses),
    },
    {
      value: CourseTabEnum.Settings,
      icon: IconSettings,
      show: can(PermissionEnum.EditCourses),
    },
  ].filter((tab) => tab.show);
  const tabOf = (path: string) =>
    tabs.find(({ value }) => path.endsWith(`/${value}`))?.value;
  const activeTab = tabOf(pathname);
  // a tab of this course whose code is still loading, such as the designer
  const target =
    navigation.state === 'loading' ? navigation.location.pathname : null;
  // the pending location keeps the router's basename, unlike useLocation
  const pendingTab = target?.startsWith(`${courseHref}/`)
    ? tabOf(target)
    : undefined;

  if (ApiRequestError.matches(request.error, ApiErrorCodeEnum.NotFound)) {
    return <NotFoundPage />;
  }
  if (request.error !== null && !course) {
    return (
      <Alert
        color="red"
        variant="light"
        icon={<IconAlertCircle size={18} stroke={1.5} />}
      >
        {describeApiError(request.error, i18n)}
      </Alert>
    );
  }
  if (!course || !context) return <PageLoader />;

  const { certificateCounts } = course;
  const lookupStatus = !course.active ? (
    <StatusLabel>{t('courses.archived')}</StatusLabel>
  ) : course.lookupEnabled ? (
    <StatusLabel color="teal">{t('courses.listedInLookup')}</StatusLabel>
  ) : (
    <StatusLabel>{t('courses.hiddenFromLookup')}</StatusLabel>
  );

  return (
    <Stack gap="xl">
      <Stack gap="sm">
        <Anchor
          component={Link}
          to={AdminPathEnum.Courses}
          size="sm"
          c="dimmed"
          w="fit-content"
        >
          <Group gap={4} wrap="nowrap">
            <IconArrowLeft size={16} stroke={1.5} />
            {t('courses.backToList')}
          </Group>
        </Anchor>
        <PageHeader
          title={course.name}
          description={localeNames(course.locale)}
        />
        <Group gap="lg" wrap="wrap">
          {lookupStatus}
          <Group gap={6} wrap="nowrap">
            <Text size="sm" c="dimmed">
              {t('courses.participants')}
            </Text>
            <MonoFigure>{numbers.format(course.participantCount)}</MonoFigure>
          </Group>
          <Group gap={6} wrap="nowrap">
            <Text size="sm" c="dimmed">
              {t('courses.certificates')}
            </Text>
            <MonoFigure>{numbers.format(certificateCounts.active)}</MonoFigure>
          </Group>
          {certificateCounts.revoked > 0 && (
            <Group gap={6} wrap="nowrap">
              <Text size="sm" c="dimmed">
                {t('courses.revoked')}
              </Text>
              <MonoFigure>
                {numbers.format(certificateCounts.revoked)}
              </MonoFigure>
            </Group>
          )}
        </Group>
      </Stack>

      <Tabs
        // the clicked tab shows at once, even while its code loads
        value={pendingTab ?? activeTab ?? null}
        onChange={(value) => {
          const tab = tabs.find((item) => item.value === value)?.value;
          if (tab) void navigate(coursePath(course.id, tab as CourseTab));
        }}
      >
        <Tabs.List aria-label={t('courses.tabsLabel')}>
          {tabs.map(({ value, icon: Icon }) => (
            <Tabs.Tab
              key={value}
              value={value}
              leftSection={<Icon size={16} stroke={1.5} />}
            >
              {t(`courses.tabs.${value}`)}
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs>

      {pendingTab && pendingTab !== activeTab ? (
        <PageLoader />
      ) : (
        <Outlet context={context} />
      )}
    </Stack>
  );
}
