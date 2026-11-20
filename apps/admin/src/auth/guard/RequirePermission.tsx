import type { Permission } from '@cert-it/shared';
import type { ReactNode } from 'react';
import { ForbiddenPage } from '../../app/error/ForbiddenPage';
import { usePermissions } from '../usePermissions';

type RequirePermissionProps = {
  permission: Permission;
  children: ReactNode;
};

/** Shows its children only if the user's role has the permission, and a page saying so otherwise. */
export function RequirePermission({
  permission,
  children,
}: RequirePermissionProps) {
  const can = usePermissions();

  return can(permission) ? children : <ForbiddenPage />;
}
