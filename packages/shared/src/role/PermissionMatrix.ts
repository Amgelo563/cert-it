import { type Permission, PermissionEnum } from './PermissionEnum';
import { type Role, RoleEnum } from './RoleEnum';

/** The permissions of each role. */
export const PermissionMatrix: Readonly<Record<Role, ReadonlySet<Permission>>> =
  {
    [RoleEnum.Admin]: new Set(Object.values(PermissionEnum)),
    [RoleEnum.Editor]: new Set([
      PermissionEnum.ViewRecords,
      PermissionEnum.EditCourses,
      PermissionEnum.EditParticipants,
      PermissionEnum.IssueCertificates,
      PermissionEnum.RevokeCertificates,
    ]),
    [RoleEnum.Viewer]: new Set([PermissionEnum.ViewRecords]),
  };

/** Returns whether the given role has the given permission. */
export function hasPermission(role: Role, permission: Permission): boolean {
  return PermissionMatrix[role].has(permission);
}
