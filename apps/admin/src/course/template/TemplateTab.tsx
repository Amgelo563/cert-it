import { BLANK_A4_PDF, type Font, type Template } from '@pdfme/common';
import { Alert, Stack } from '@mantine/core';
import { IconAlertCircle, IconInfoCircle } from '@tabler/icons-react';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ApiRoutes } from '../../app/api/ApiClient';
import { describeApiError } from '../../app/api/describeApiError';
import { useApiRequest } from '../../app/api/useApiRequest';
import { PageLoader } from '../../app/layout/PageLoader';
import { useCourse } from '../useCourse';
import { TemplateDesigner } from './designer/TemplateDesigner';
import { useTemplateFiles } from './useTemplateFiles';

// a course without a template starts from an empty A4 page
const BlankTemplate: Template = { basePdf: BLANK_A4_PDF, schemas: [[]] };

const NoFonts: Font = {};

/** A course's certificate template, in the Designer: its latest version, or a blank page if it has none. */
export function TemplateTab() {
  const { t, i18n } = useTranslation();
  const { course } = useCourse();
  const courseId = String(course.id);

  const request = useApiRequest(
    useCallback(
      (routes: ApiRoutes) =>
        routes.courses[':courseId'].template.$get({ param: { courseId } }),
      [courseId],
    ),
  );
  // null once loaded means the course has no template yet
  const detail =
    request.data && String(request.data.courseId) === courseId
      ? request.data
      : null;
  const files = useTemplateFiles(detail);

  const template = useMemo<Template | null>(
    () =>
      detail && files.files
        ? { ...detail.template, basePdf: files.files.basePdf }
        : null,
    [detail, files.files],
  );
  // the first font is the fallback pdfme asks for; every field names its own
  const fonts = useMemo<Font>(
    () =>
      files.files
        ? Object.fromEntries(
            [...files.files.fonts].map(([sha256, data], index) => [
              sha256,
              { data, fallback: index === 0 },
            ]),
          )
        : NoFonts,
    [files.files],
  );

  const error = request.error ?? files.error;
  if (error !== null) {
    return (
      <Alert
        color="red"
        variant="light"
        icon={<IconAlertCircle size={18} stroke={1.5} />}
      >
        {describeApiError(error, i18n)}
      </Alert>
    );
  }

  const empty = request.data === null;
  if (!empty && !template) return <PageLoader />;

  return (
    <Stack gap="md">
      {empty && (
        <Alert
          variant="light"
          title={t('template.emptyTitle')}
          icon={<IconInfoCircle size={18} stroke={1.5} />}
        >
          {t('template.emptyText')}
        </Alert>
      )}
      <TemplateDesigner template={template ?? BlankTemplate} fonts={fonts} />
    </Stack>
  );
}
