import { type OutdatedCertificates, PermissionEnum } from '@cert-it/shared';
import { Alert } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconAlertCircle } from '@tabler/icons-react';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ApiRoutes } from '../../app/api/ApiClient';
import { describeApiError } from '../../app/api/describeApiError';
import { useApiClient } from '../../app/api/useApiClient';
import { useApiRequest } from '../../app/api/useApiRequest';
import { PageLoader } from '../../app/layout/PageLoader';
import { usePermissions } from '../../auth/usePermissions';
import { RegenerateCertificatesModal } from '../certificates/regenerate/RegenerateCertificatesModal';
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
  fontInfo: new Map(),
};

/** A course's certificate template, in the Designer: its latest version, or a prompt for a base PDF if it has none. */
export function TemplateTab() {
  const { t, i18n } = useTranslation();
  const api = useApiClient();
  const can = usePermissions();
  const { course, reload } = useCourse();
  const courseId = String(course.id);
  // certificates on an older version after a save, to offer regenerating them
  const [outdated, setOutdated] = useState<OutdatedCertificates | null>(null);

  const saved = () => {
    reload();
    if (!can(PermissionEnum.IssueCertificates)) return;
    api
      .request((routes) =>
        routes.courses[':courseId'].certificates.outdated.$get({
          param: { courseId },
        }),
      )
      .then(
        (answer) => {
          if (answer.items.length > 0) setOutdated(answer);
        },
        // the Certificates tab offers it too
        () => {},
      );
  };

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
      fontInfo: new Map(detail.fonts.map((font) => [font.sha256, font])),
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
    <>
      <TemplateEditor
        key={courseId}
        course={course}
        start={start}
        onSaved={saved}
      />
      {outdated && (
        <RegenerateCertificatesModal
          opened
          courseId={course.id}
          outdated={outdated}
          onClose={() => setOutdated(null)}
          onRegenerated={(job) => {
            notifications.show({
              color: 'teal',
              message: t('regenerate.startedElsewhere', { count: job.total }),
            });
            setOutdated(null);
          }}
        />
      )}
    </>
  );
}
