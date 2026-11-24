import '@fontsource-variable/inter/wght.css';
import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import '@mantine/notifications/styles.css';
import 'mantine-datatable/styles.css';
import { MantineProvider } from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';
import { Notifications } from '@mantine/notifications';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { ApiClient } from './app/api/ApiClient';
import { ApiClientContext } from './app/api/ApiClientContext';
import { AdminI18n } from './app/i18n/AdminI18n';
import { AdminBaseUrl } from './app/router/AdminBaseUrl';
import { AdminRoutes } from './app/router/AdminRoutes';
import { AdminCssVariables, AdminTheme } from './app/theme/AdminTheme';

const i18n = AdminI18n.create();
await i18n.start();

const api = ApiClient.create();

// the server injects <base href="{base_path}/admin/">, so one build works under any path
const router = createBrowserRouter(AdminRoutes, {
  basename: AdminBaseUrl.create().getRouterBasename(),
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nextProvider i18n={i18n.getInstance()}>
      {/* no ColorSchemeScript: it's an inline script, which the admin CSP blocks */}
      <MantineProvider
        theme={AdminTheme}
        cssVariablesResolver={AdminCssVariables}
        defaultColorScheme="auto"
      >
        <Notifications position="bottom-right" />
        <ApiClientContext value={api}>
          <ModalsProvider>
            <RouterProvider router={router} />
          </ModalsProvider>
        </ApiClientContext>
      </MantineProvider>
    </I18nextProvider>
  </StrictMode>,
);
