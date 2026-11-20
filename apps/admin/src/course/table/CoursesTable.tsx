import type { CourseSummary } from '@cert-it/shared';
import { Anchor, Stack, Text } from '@mantine/core';
import { DataTable } from 'mantine-datatable';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { useLocaleNames } from '../../app/i18n/useLocaleNames';
import { MonoFigure } from '../../app/layout/MonoFigure';
import { StatusLabel } from '../../app/layout/StatusLabel';
import { coursePath } from '../CourseTabEnum';

type CoursesTableProps = {
  courses: readonly CourseSummary[];
  total: number;
  page: number;
  pageSize: number;
  loading: boolean;
  onPageChange: (page: number) => void;
};

/** One page of courses with their counts and lookup status; a row opens its course. */
export function CoursesTable({
  courses,
  total,
  page,
  pageSize,
  loading,
  onPageChange,
}: CoursesTableProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const localeNames = useLocaleNames();

  const dates = useMemo(
    () => new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }),
    [i18n.language],
  );
  const numbers = useMemo(
    () => new Intl.NumberFormat(i18n.language),
    [i18n.language],
  );

  return (
    <DataTable<CourseSummary>
      records={[...courses]}
      idAccessor="id"
      fetching={loading}
      minHeight={courses.length === 0 ? 200 : undefined}
      highlightOnHover
      verticalSpacing="sm"
      noRecordsText={t('courses.empty')}
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
      // the name is also a link, for the keyboard and for new tabs
      onRowClick={({ record }) => void navigate(coursePath(record.id))}
      columns={[
        {
          accessor: 'name',
          title: t('courses.name'),
          render: (course) => (
            <Stack gap={2}>
              <Anchor
                component={Link}
                to={coursePath(course.id)}
                size="sm"
                fw={500}
                c={course.active ? 'var(--mantine-color-text)' : 'dimmed'}
                onClick={(event) => event.stopPropagation()}
              >
                {course.name}
              </Anchor>
              <Text size="xs" c="dimmed">
                {localeNames(course.locale)}
              </Text>
            </Stack>
          ),
        },
        {
          accessor: 'participantCount',
          title: t('courses.participants'),
          textAlign: 'right',
          noWrap: true,
          render: (course) => (
            <MonoFigure>{numbers.format(course.participantCount)}</MonoFigure>
          ),
        },
        {
          accessor: 'certificateCounts',
          title: t('courses.certificates'),
          textAlign: 'right',
          noWrap: true,
          render: ({ certificateCounts }) => (
            <Stack gap={2} align="flex-end">
              <MonoFigure>
                {numbers.format(certificateCounts.active)}
              </MonoFigure>
              {certificateCounts.revoked > 0 && (
                <Text size="xs" c="dimmed">
                  {t('courses.revokedCount', {
                    count: numbers.format(certificateCounts.revoked),
                  })}
                </Text>
              )}
            </Stack>
          ),
        },
        {
          accessor: 'lookupEnabled',
          title: t('courses.lookup'),
          noWrap: true,
          // archived courses leave the lookup whatever the switch says
          render: (course) =>
            !course.active ? (
              <StatusLabel>{t('courses.archived')}</StatusLabel>
            ) : course.lookupEnabled ? (
              <StatusLabel color="teal">{t('courses.listed')}</StatusLabel>
            ) : (
              <StatusLabel>{t('courses.hidden')}</StatusLabel>
            ),
        },
        {
          accessor: 'createdAt',
          title: t('courses.createdAt'),
          noWrap: true,
          render: (course) => (
            <MonoFigure>{dates.format(new Date(course.createdAt))}</MonoFigure>
          ),
        },
      ]}
    />
  );
}
