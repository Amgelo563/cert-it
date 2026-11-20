import { Button, Group, SimpleGrid, Stack, Text } from '@mantine/core';
import { IconArrowRight } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { usePermissions } from '../auth/usePermissions';
import { AdminPagePermissions } from '../app/router/AdminPagePermissions';
import { PageHeader } from '../app/layout/PageHeader';
import { Surface } from '../app/layout/Surface';
import { AdminPathEnum } from '../app/router/AdminPathEnum';

/** Landing page of the admin panel. */
export function HomePage() {
  const { t } = useTranslation();
  const can = usePermissions();

  return (
    <Stack gap="xl">
      <PageHeader title={t('home.title')} description={t('home.description')} />

      <SimpleGrid cols={{ base: 1, md: 2, xl: 3 }} spacing="lg">
        {can(AdminPagePermissions[AdminPathEnum.TemplateDesigner]) && (
          <Surface p="lg">
            <Stack gap="md" h="100%">
              <Stack gap={4}>
                <Text fw={500} size="lg">
                  {t('home.designerCardTitle')}
                </Text>
                <Text c="dimmed" size="sm">
                  {t('home.designerCardDescription')}
                </Text>
              </Stack>
              <Group mt="auto">
                <Button
                  component={Link}
                  to={AdminPathEnum.TemplateDesigner}
                  variant="light"
                  rightSection={<IconArrowRight size={16} stroke={1.5} />}
                >
                  {t('home.designerCardAction')}
                </Button>
              </Group>
            </Stack>
          </Surface>
        )}
      </SimpleGrid>
    </Stack>
  );
}
