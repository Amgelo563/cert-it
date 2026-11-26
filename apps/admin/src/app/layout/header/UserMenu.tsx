import {
  Avatar,
  Badge,
  Menu,
  Stack,
  Text,
  UnstyledButton,
} from '@mantine/core';
import { IconHelpCircle, IconKey, IconLogout } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../../../auth/useAuth';
import { useOnboarding } from '../../../onboarding/useOnboarding';
import { MonoFigure } from '../MonoFigure';
import { AdminPathEnum } from '../../router/AdminPathEnum';

/** Avatar with the logged-in user's name, email, role, password change and logout. */
export function UserMenu() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const onboarding = useOnboarding();
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
            {user.name.charAt(0).toUpperCase()}
          </Avatar>
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown>
        <Stack gap={6} px="sm" py="xs">
          <Stack gap={0}>
            <Text size="sm" fw={500} truncate="end">
              {user.name}
            </Text>
            <Text size="xs" c="dimmed" truncate="end">
              {user.email}
            </Text>
          </Stack>
          <Badge size="sm" w="fit-content">
            {t(`roles.${user.role}`)}
          </Badge>
        </Stack>
        <Menu.Item
          leftSection={<IconHelpCircle size={16} stroke={1.5} />}
          rightSection={
            onboarding.state && (
              <MonoFigure>
                {t('onboarding.hub.progress', {
                  done: onboarding.state.completedSteps.length,
                  total: onboarding.steps.length,
                })}
              </MonoFigure>
            )
          }
          onClick={onboarding.openHub}
        >
          {t('onboarding.hub.menuItem')}
        </Menu.Item>
        <Menu.Item
          component={Link}
          to={AdminPathEnum.ChangePassword}
          leftSection={<IconKey size={16} stroke={1.5} />}
        >
          {t('auth.changePassword')}
        </Menu.Item>
        <Menu.Item
          color="red"
          leftSection={<IconLogout size={16} stroke={1.5} />}
          onClick={() => void signOut()}
        >
          {t('auth.logout')}
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
