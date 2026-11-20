import { hasPermission, type Permission } from '@cert-it/shared';
import { useCallback } from 'react';
import { useAuth } from './useAuth';

/** Returns a function that says whether the logged-in user's role has a permission, by the shared permission matrix; undefined means none is needed. */
export function usePermissions(): (
  permission: Permission | undefined,
) => boolean {
  const { user } = useAuth();

  return useCallback(
    (permission) =>
      user !== null
      && (permission === undefined || hasPermission(user.role, permission)),
    [user],
  );
}
