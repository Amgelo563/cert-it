import { Alert } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ApiRoutes } from '../../app/api/ApiClient';
import { describeApiError } from '../../app/api/describeApiError';
import { useApiRequest } from '../../app/api/useApiRequest';
import { PageLoader } from '../../app/layout/PageLoader';
import { useCourse } from '../useCourse';
import {
  TemplateEditor,
  type TemplateEditorStart,
} from './editor/TemplateEditor';
import { useTemplateFiles } from './useTemplateFiles';

// a course without a template waits for its base PDF
const BlankStart: TemplateEditorStart = {
  version: null,
  content: { schemas: [[]] },
  basePdf: null,
  fonts: new Map(),
};

/** A course's certificate template, in the Designer: its latest version, or a prompt for a base PDF if it has none. */
export function TemplateTab() {
  const { i18n } = useTranslation();
  const { course, reload } = useCourse();
  const courseId = String(course.id);

  const request = useApiRequest(
    useCallback(
      (routes: ApiRoutes) =>
        routes.courses[':courseId'].template.$get({ param: { courseId } }),
      [courseId],
    ),
  );
  // the last answer may be for the course before a link to another
  const current = request.loading ? undefined : request.data;
  const detail = current ?? null;
  const files = useTemplateFiles(detail);

  const start = useMemo<TemplateEditorStart | null>(() => {
    if (current === null) return BlankStart;
    if (!detail || !files.files) return null;

    const { basePdf, fonts } = files.files;
    return {
      version: detail.version,
      content: detail.template,
      basePdf: { sha256: detail.basePdf, bytes: basePdf },
      fonts,
    };
  }, [current, detail, files.files]);

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
  if (!start) return <PageLoader />;

  // loaded once per course; saving keeps the canvas as it is
  return (
    <TemplateEditor
      key={courseId}
      courseId={course.id}
      start={start}
      onSaved={reload}
    />
  );
}
