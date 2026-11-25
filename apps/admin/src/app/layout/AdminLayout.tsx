import { AppShell, Progress } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useNavigation } from 'react-router';
import { PracticeBar } from '../../onboarding/practice/PracticeBar';
import classes from './AdminLayout.module.css';
import { AdminHeader } from './header/AdminHeader';
import { AdminSidebar } from './sidebar/AdminSidebar';

/** Sidebar and header around every admin page. */
export function AdminLayout() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const [mobileOpened, { toggle: toggleMobile, close: closeMobile }] =
    useDisclosure(false);
  const [desktopOpened, { toggle: toggleDesktop }] = useDisclosure(true);

  useEffect(() => {
    document.title = t('app.title');
  }, [t]);

  return (
    <AppShell
      className={classes.root}
      // sidebar at full height, beside the header
      layout="alt"
      withBorder={false}
      header={{ height: 64 }}
      navbar={{
        width: 272,
        breakpoint: 'sm',
        collapsed: { mobile: !mobileOpened, desktop: !desktopOpened },
      }}
      padding={0}
    >
      {navigation.state === 'loading' && (
        <Progress
          className={classes.progress}
          value={100}
          size={3}
          radius={0}
        />
      )}

      <AppShell.Header className={classes.header}>
        <AdminHeader
          onToggleNavigation={() => {
            toggleMobile();
            toggleDesktop();
          }}
        />
      </AppShell.Header>

      <AppShell.Navbar className={classes.navbar}>
        <AdminSidebar onClose={closeMobile} />
      </AppShell.Navbar>

      <AppShell.Main className={classes.main}>
        <div className={classes.content}>
          <PracticeBar />
          <Outlet />
        </div>
      </AppShell.Main>
    </AppShell>
  );
}
