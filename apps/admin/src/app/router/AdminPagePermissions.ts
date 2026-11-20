import { type Permission, PermissionEnum } from '@cert-it/shared';
import { type AdminPath, AdminPathEnum } from './AdminPathEnum';

/** The permission each page needs, for both its route and its sidebar link; pages left out are open to every logged-in user. */
export const AdminPagePermissions: Readonly<
  Partial<Record<AdminPath, Permission>>
> = {
  [AdminPathEnum.TemplateDesigner]: PermissionEnum.EditCourses,
  [AdminPathEnum.Users]: PermissionEnum.ManageUsers,
  [AdminPathEnum.AuditLog]: PermissionEnum.ViewAuditLog,
};
