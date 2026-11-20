import {
  type Icon,
  IconCertificate,
  IconHistory,
  IconHome,
  IconUsers,
} from '@tabler/icons-react';
import type { AdminMessages } from '../../i18n/messages/AdminMessages';
import { type AdminPath, AdminPathEnum } from '../../router/AdminPathEnum';

type NavigationKey = keyof AdminMessages['navigation'];

/** A sidebar section: a title and its links, each shown only if the user may open its page. */
export type AdminNavigationSection = {
  title: NavigationKey;
  links: { label: NavigationKey; icon: Icon; to: AdminPath }[];
};

/** Sections of the sidebar, in order. */
export const AdminNavigation: AdminNavigationSection[] = [
  {
    title: 'overview',
    links: [
      { label: 'home', icon: IconHome, to: AdminPathEnum.Home },
      { label: 'courses', icon: IconCertificate, to: AdminPathEnum.Courses },
    ],
  },
  {
    title: 'administration',
    links: [
      { label: 'users', icon: IconUsers, to: AdminPathEnum.Users },
      { label: 'auditLog', icon: IconHistory, to: AdminPathEnum.AuditLog },
    ],
  },
];
