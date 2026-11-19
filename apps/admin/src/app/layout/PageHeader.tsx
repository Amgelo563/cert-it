import { Flex, Stack, Text, Title } from '@mantine/core';
import type { ReactNode } from 'react';
import classes from './PageHeader.module.css';

type PageHeaderProps = {
  title: string;
  description?: string;
  /** Shown on the right, or under the title on phones. */
  actions?: ReactNode;
};

/** Title, description and actions at the top of a page, straight on the page background. */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <Flex
      justify="space-between"
      align={{ base: 'flex-start', sm: 'flex-end' }}
      direction={{ base: 'column', sm: 'row' }}
      gap="md"
    >
      <Stack gap={4}>
        <Title order={1} className={classes.title}>
          {title}
        </Title>
        {description && <Text c="dimmed">{description}</Text>}
      </Stack>
      {actions}
    </Flex>
  );
}
