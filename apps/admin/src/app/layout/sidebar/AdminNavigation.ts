import { type Icon, IconHome, IconTemplate } from '@tabler/icons-react';
import type { AdminMessages } from '../../i18n/messages/AdminMessages';
import { AdminPathEnum } from '../../router/AdminPathEnum';

type NavigationKey = keyof AdminMessages['navigation'];

/** A sidebar section: a title and its links. */
export type AdminNavigationSection = {
  title: NavigationKey;
  links: { label: NavigationKey; icon: Icon; to: string }[];
};

/** Sections of the sidebar, in order. */
export const AdminNavigation: AdminNavigationSection[] = [
  {
    title: 'overview',
    links: [{ label: 'home', icon: IconHome, to: AdminPathEnum.Home }],
  },
  {
    title: 'templates',
    links: [
      {
        label: 'templateDesigner',
        icon: IconTemplate,
        to: AdminPathEnum.TemplateDesigner,
      },
    ],
  },
];
