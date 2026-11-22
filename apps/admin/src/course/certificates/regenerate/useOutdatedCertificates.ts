import { useCallback } from 'react';
import type { ApiRoutes } from '../../../app/api/ApiClient';
import { useApiRequest } from '../../../app/api/useApiRequest';

/** Loads a course's certificates on an older template version than its latest. */
export function useOutdatedCertificates(courseId: number) {
  return useApiRequest(
    useCallback(
      (routes: ApiRoutes) =>
        routes.courses[':courseId'].certificates.outdated.$get({
          param: { courseId: String(courseId) },
        }),
      [courseId],
    ),
  );
}
