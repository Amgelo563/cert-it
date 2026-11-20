import { type Role, RoleEnum, type UserSummary } from '@cert-it/shared';
import { ActionIcon, Group, Menu, Select, Text } from '@mantine/core';
import {
  IconDots,
  IconKey,
  IconUserCheck,
  IconUserOff,
} from '@tabler/icons-react';
import { DataTable } from 'mantine-datatable';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { MonoFigure } from '../../app/layout/MonoFigure';
import { StatusLabel } from '../../app/layout/StatusLabel';
import { useAuth } from '../../auth/useAuth';

type UsersTableProps = {
  users: readonly UserSummary[];
  total: number;
  page: number;
  pageSize: number;
  loading: boolean;
  /** The user whose change is being sent, whose controls are disabled meanwhile. */
  busyId: number | null;
  onPageChange: (page: number) => void;
  onChangeRole: (user: UserSummary, role: Role) => void;
  onSetActive: (user: UserSummary, active: boolean) => void;
  onResetPassword: (user: UserSummary) => void;
};

/** One page of users, with their role, status and the actions on each; the logged-in user's own row can't be changed here. */
export function UsersTable({
  users,
  total,
  page,
  pageSize,
  loading,
  busyId,
  onPageChange,
  onChangeRole,
  onSetActive,
  onResetPassword,
}: UsersTableProps) {
  const { t, i18n } = useTranslation();
  const { user: me } = useAuth();

  const roles = useMemo(
    () =>
      Object.values(RoleEnum).map((role) => ({
        value: role,
        label: t(`roles.${role}`),
      })),
    [t],
  );
  const dates = useMemo(
    () => new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }),
    [i18n.language],
  );

  return (
    <DataTable<UserSummary>
      records={[...users]}
      idAccessor="id"
      fetching={loading}
      minHeight={users.length === 0 ? 200 : undefined}
      highlightOnHover
      verticalSpacing="sm"
      noRecordsText={t('users.empty')}
      loadingText={t('app.loading')}
      totalRecords={total}
      recordsPerPage={pageSize}
      page={page}
      onPageChange={onPageChange}
      paginationText={({ from, to, totalRecords }) =>
        t('table.range', { from, to, total: totalRecords })
      }
      getPaginationControlProps={(control) => ({
        'aria-label': t(`table.${control}Page`),
      })}
      columns={[
        {
          accessor: 'email',
          noWrap: true,
          title: t('users.email'),
          render: (user) => (
            <Group gap="xs" wrap="nowrap">
              <Text size="sm" fw={500}>
                {user.email}
              </Text>
              {user.id === me?.id && (
                <Text size="xs" c="dimmed">
                  {t('users.you')}
                </Text>
              )}
            </Group>
          ),
        },
        {
          accessor: 'role',
          title: t('users.role'),
          width: 150,
          render: (user) => (
            <Select
              size="xs"
              data={roles}
              value={user.role}
              allowDeselect={false}
              disabled={user.id === me?.id || user.id === busyId}
              aria-label={t('users.changeRole', { email: user.email })}
              onChange={(value) => {
                const role = Object.values(RoleEnum).find((r) => r === value);
                if (role && role !== user.role) onChangeRole(user, role);
              }}
            />
          ),
        },
        {
          accessor: 'active',
          noWrap: true,
          title: t('users.status'),
          // a temporary password only matters while the account is active
          render: (user) =>
            !user.active ? (
              <StatusLabel>{t('users.inactive')}</StatusLabel>
            ) : user.mustChangePassword ? (
              <StatusLabel color="orange">
                {t('users.temporaryPassword')}
              </StatusLabel>
            ) : (
              <StatusLabel color="teal">{t('users.active')}</StatusLabel>
            ),
        },
        {
          accessor: 'createdAt',
          noWrap: true,
          title: t('users.createdAt'),
          render: (user) => (
            <MonoFigure>{dates.format(new Date(user.createdAt))}</MonoFigure>
          ),
        },
        {
          accessor: 'actions',
          title: '',
          textAlign: 'right',
          width: 60,
          render: (user) =>
            user.id === me?.id ? null : (
              <Menu position="bottom-end" width={220}>
                <Menu.Target>
                  <ActionIcon
                    disabled={user.id === busyId}
                    aria-label={t('users.actions', { email: user.email })}
                  >
                    <IconDots size={18} stroke={1.5} />
                  </ActionIcon>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Item
                    leftSection={<IconKey size={16} stroke={1.5} />}
                    onClick={() => onResetPassword(user)}
                  >
                    {t('users.resetPassword')}
                  </Menu.Item>
                  {user.active ? (
                    <Menu.Item
                      color="red"
                      leftSection={<IconUserOff size={16} stroke={1.5} />}
                      onClick={() => onSetActive(user, false)}
                    >
                      {t('users.deactivate')}
                    </Menu.Item>
                  ) : (
                    <Menu.Item
                      leftSection={<IconUserCheck size={16} stroke={1.5} />}
                      onClick={() => onSetActive(user, true)}
                    >
                      {t('users.reactivate')}
                    </Menu.Item>
                  )}
                </Menu.Dropdown>
              </Menu>
            ),
        },
      ]}
    />
  );
}
