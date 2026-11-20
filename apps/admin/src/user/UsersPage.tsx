import type { Role, UserSummary } from '@cert-it/shared';
import { Alert, Button, Group, Stack, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { IconAlertCircle, IconUserPlus } from '@tabler/icons-react';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ApiRoutes } from '../app/api/ApiClient';
import { describeApiError } from '../app/api/describeApiError';
import { useApiClient } from '../app/api/useApiClient';
import { useApiRequest } from '../app/api/useApiRequest';
import { PageHeader } from '../app/layout/PageHeader';
import { Surface } from '../app/layout/Surface';
import { AddUserModal } from './add/AddUserModal';
import {
  type IssuedPassword,
  OneTimePasswordModal,
} from './password/OneTimePasswordModal';
import { UsersTable } from './table/UsersTable';

const PageSize = 25;

/** The admin panel's users: add them, change their role, deactivate them or reset their password. */
export function UsersPage() {
  const { t, i18n } = useTranslation();
  const api = useApiClient();
  const [page, setPage] = useState(1);
  const [adding, { open: openAdd, close: closeAdd }] = useDisclosure(false);
  const [issued, setIssued] = useState<IssuedPassword | null>(null);
  // the user whose change is being sent, so their row can't send another
  const [busyId, setBusyId] = useState<number | null>(null);

  const users = useApiRequest(
    useCallback(
      (routes: ApiRoutes) =>
        routes.users.$get({
          query: { page: String(page), size: String(PageSize) },
        }),
      [page],
    ),
  );

  // sends a change to one user, then reports it and reloads the list
  const change = async (
    user: UserSummary,
    send: () => Promise<unknown>,
    success: string,
  ) => {
    setBusyId(user.id);
    try {
      await send();
      notifications.show({ color: 'teal', message: success });
      users.reload();
    } catch (error) {
      notifications.show({
        color: 'red',
        message: describeApiError(error, i18n),
      });
    } finally {
      setBusyId(null);
    }
  };

  const update = (
    user: UserSummary,
    json: { role?: Role; active?: boolean },
    success: string,
  ) =>
    change(
      user,
      () =>
        api.request((routes) =>
          routes.users[':id'].$patch({ param: { id: String(user.id) }, json }),
        ),
      success,
    );

  const changeRole = (user: UserSummary, role: Role) =>
    void update(
      user,
      { role },
      t('users.roleChanged', { email: user.email, role: t(`roles.${role}`) }),
    );

  const setActive = (user: UserSummary, active: boolean) =>
    modals.openConfirmModal({
      title: active ? t('users.reactivateTitle') : t('users.deactivateTitle'),
      children: (
        <Text size="sm">
          {active
            ? t('users.reactivateText', { email: user.email })
            : t('users.deactivateText', { email: user.email })}
        </Text>
      ),
      labels: {
        confirm: active ? t('users.reactivate') : t('users.deactivate'),
        cancel: t('auth.cancel'),
      },
      confirmProps: { color: active ? undefined : 'red' },
      onConfirm: () =>
        void update(
          user,
          { active },
          active
            ? t('users.reactivated', { email: user.email })
            : t('users.deactivated', { email: user.email }),
        ),
    });

  const resetPassword = (user: UserSummary) =>
    modals.openConfirmModal({
      title: t('users.resetPasswordTitle'),
      children: (
        <Text size="sm">
          {t('users.resetPasswordText', { email: user.email })}
        </Text>
      ),
      labels: { confirm: t('users.resetPassword'), cancel: t('auth.cancel') },
      confirmProps: { color: 'red' },
      onConfirm: () =>
        void change(
          user,
          async () => {
            const { password } = await api.request((routes) =>
              routes.users[':id']['reset-password'].$post({
                param: { id: String(user.id) },
              }),
            );
            setIssued({ email: user.email, password });
          },
          t('users.passwordReset', { email: user.email }),
        ),
    });

  return (
    <Stack gap="xl">
      <PageHeader
        title={t('users.title')}
        description={t('users.description')}
        actions={
          <Button
            leftSection={<IconUserPlus size={16} stroke={1.6} />}
            onClick={openAdd}
          >
            {t('users.add')}
          </Button>
        }
      />

      <Surface p="lg">
        <Stack gap="md">
          <Group justify="space-between">
            <Text fw={600} size="lg">
              {t('users.listTitle')}
            </Text>
            {users.data && (
              <Text c="dimmed" size="sm">
                {t('users.count', { count: users.data.total })}
              </Text>
            )}
          </Group>
          {users.error !== null && (
            <Alert
              color="red"
              variant="light"
              icon={<IconAlertCircle size={20} stroke={1.6} />}
            >
              {describeApiError(users.error, i18n)}
            </Alert>
          )}
          <UsersTable
            users={users.data?.items ?? []}
            total={users.data?.total ?? 0}
            page={page}
            pageSize={PageSize}
            loading={users.loading}
            busyId={busyId}
            onPageChange={setPage}
            onChangeRole={changeRole}
            onSetActive={setActive}
            onResetPassword={resetPassword}
          />
        </Stack>
      </Surface>

      <AddUserModal
        opened={adding}
        onClose={closeAdd}
        onCreated={({ user, password }) => {
          closeAdd();
          setIssued({ email: user.email, password });
          notifications.show({
            color: 'teal',
            message: t('users.added', { email: user.email }),
          });
          users.reload();
        }}
      />
      <OneTimePasswordModal issued={issued} onClose={() => setIssued(null)} />
    </Stack>
  );
}
