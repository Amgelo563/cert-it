import type { TemplateDetail } from '@cert-it/shared';
import { useEffect, useState } from 'react';
import { useApiClient } from '../../app/api/useApiClient';

/** The bytes the Designer needs for a template version. */
export type TemplateFiles = {
  /** The template version these files are for. */
  templateId: number;
  basePdf: ArrayBuffer;
  /** Font bytes by SHA-256, the name its text fields use. */
  fonts: ReadonlyMap<string, ArrayBuffer>;
};

type TemplateFilesState = {
  files: TemplateFiles | null;
  error: unknown;
};

/** Downloads the base PDF and fonts of a template version, all at once. The browser caches them, since their URLs hold their hash. */
export function useTemplateFiles(
  template: TemplateDetail | null,
): TemplateFilesState {
  const api = useApiClient();
  const [state, setState] = useState<TemplateFilesState>({
    files: null,
    error: null,
  });

  useEffect(() => {
    if (!template) return;
    let current = true;
    const courseId = String(template.courseId);

    Promise.all([
      api.requestBytes((routes) =>
        routes.courses[':courseId'].template['base-pdf'][':sha256'].$get({
          param: { courseId, sha256: template.basePdf },
        }),
      ),
      ...template.fonts.map(async ({ sha256 }) => {
        const bytes = await api.requestBytes((routes) =>
          routes.fonts[':sha256'].$get({ param: { sha256 } }),
        );
        return [sha256, bytes] as const;
      }),
    ]).then(
      ([basePdf, ...fonts]) => {
        if (!current) return;
        setState({
          files: { templateId: template.id, basePdf, fonts: new Map(fonts) },
          error: null,
        });
      },
      (error: unknown) => {
        if (current) setState({ files: null, error });
      },
    );

    return () => {
      current = false;
    };
  }, [api, template]);

  // files of a previous version don't count while the new ones load
  const files =
    template && state.files?.templateId === template.id ? state.files : null;
  return { files, error: state.error };
}
