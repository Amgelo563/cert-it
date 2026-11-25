import { Button, Group, Stack, Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { MonoFigure } from '../../app/layout/MonoFigure';
import type { TourView } from './TourRunner';

type TourCardProps = {
  /** Key of the tour's messages, such as createCourse. */
  tour: string;
  view: TourView;
  onNext: () => void;
  onBack: () => void;
  onClose: () => void;
};

/** The content of a tour step's popover: its text, position and buttons. */
export function TourCard({
  tour,
  view,
  onNext,
  onBack,
  onClose,
}: TourCardProps) {
  const { t } = useTranslation();
  const { step, current, total } = view;
  // keys come from the tour definitions, which match the messages' shape
  const text = (part: 'title' | 'body') =>
    t(`onboarding.tours.${tour}.${step.key}.${part}` as never);
  const waits = step.waitFor !== undefined || step.until !== undefined;
  const last = current === total;

  return (
    <Stack gap="sm">
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Text fw={500}>{text('title')}</Text>
        <MonoFigure>
          {t('onboarding.tour.progress', { current, total })}
        </MonoFigure>
      </Group>
      <Text size="sm" c="dimmed">
        {text('body')}
      </Text>
      {waits && (
        <Text size="sm" fw={500}>
          {t('onboarding.tour.doIt')}
        </Text>
      )}
      <Group justify="space-between" mt={4}>
        <Button variant="subtle" color="gray" size="xs" onClick={onClose}>
          {t('onboarding.tour.close')}
        </Button>
        <Group gap="xs">
          {view.canGoBack && (
            <Button variant="subtle" color="gray" size="xs" onClick={onBack}>
              {t('onboarding.tour.back')}
            </Button>
          )}
          {!waits && (
            <Button size="xs" onClick={onNext}>
              {last ? t('onboarding.tour.finish') : t('onboarding.tour.next')}
            </Button>
          )}
        </Group>
      </Group>
    </Stack>
  );
}
