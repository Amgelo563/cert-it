import type { Permission } from '@cert-it/shared';
import { Outlet, useOutletContext } from 'react-router';
import { RequirePermission } from '../auth/guard/RequirePermission';

type RequireCoursePermissionProps = {
  permission: Permission;
};

/** Shows a course's tab only to roles with the permission, passing the course on to it. */
export function RequireCoursePermission({
  permission,
}: RequireCoursePermissionProps) {
  const context = useOutletContext();

  return (
    <RequirePermission permission={permission}>
      <Outlet context={context} />
    </RequirePermission>
  );
}
