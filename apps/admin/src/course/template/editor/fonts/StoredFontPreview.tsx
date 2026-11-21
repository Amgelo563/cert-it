import type { FontSummary } from '@cert-it/shared';
import { useCallback } from 'react';
import type { ApiRoutes } from '../../../../app/api/ApiClient';
import { useApiRequest } from '../../../../app/api/useApiRequest';
import { FontPreviewText } from './FontPreviewText';

type StoredFontPreviewProps = {
  font: FontSummary;
};

/** A stored font's name, drawn in that font. */
export function StoredFontPreview({ font }: StoredFontPreviewProps) {
  const request = useApiRequest(
    useCallback(
      (routes: ApiRoutes) =>
        routes.fonts[':sha256'].preview.$get({
          param: { sha256: font.sha256 },
        }),
      [font.sha256],
    ),
  );

  return (
    <FontPreviewText
      preview={request.data}
      label={`${font.family} ${font.style}`}
      height={22}
    />
  );
}
