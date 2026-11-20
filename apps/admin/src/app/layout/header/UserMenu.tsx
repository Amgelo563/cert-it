import {
  Avatar,
  Badge,
  Menu,
  Stack,
  Text,
  UnstyledButton,
} from '@mantine/core';
import { IconKey, IconLogout } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../../../auth/useAuth';
import { AdminPathEnum } from '../../router/AdminPathEnum';

/** Avatar with the logged-in user's email, role, password change and logout. */
export function UserMenu() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  if (!user) return null;

  const signOut = async () => {
    await logout();
    await navigate(AdminPathEnum.Login, { replace: true });
  };

  return (
    <Menu width={240} position="bottom-end">
      <Menu.Target>
        <UnstyledButton aria-label={t('auth.accountMenu')} ml="xs">
          <Avatar color="brand" radius="xl" size={34}>
            {user.email.charAt(0).toUpperCase()}
          </Avatar>
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown>
        <Stack gap={6} px="sm" py="xs">
          <Text size="sm" fw={600} truncate="end">
            {user.email}
          </Text>
          <Badge size="sm" w="fit-content">
            {t(`roles.${user.role}`)}
          </Badge>
        </Stack>
        <Menu.Item
          component={Link}
          to={AdminPathEnum.ChangePassword}
          leftSection={<IconKey size={16} stroke={1.6} />}
        >
          {t('auth.changePassword')}
        </Menu.Item>
        <Menu.Item
          color="red"
          leftSection={<IconLogout size={16} stroke={1.6} />}
          onClick={() => void signOut()}
        >
          {t('auth.logout')}
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
