import { Stack, Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { Surface } from '../../app/layout/Surface';
import { useCourse } from '../useCourse';

/** The participants of a course. */
export function ParticipantsTab() {
  const { t } = useTranslation();
  const { course } = useCourse();

  return (
    <Surface p="lg">
      <Stack gap="md">
        <Text fw={500} size="lg">
          {t('courses.tabs.participants')}
        </Text>
        <Text c="dimmed" size="sm" ta="center" py="xl">
          {course.participantCount === 0
            ? t('courses.noParticipants')
            : t('courses.count', { count: course.participantCount })}
        </Text>
      </Stack>
    </Surface>
  );
}
