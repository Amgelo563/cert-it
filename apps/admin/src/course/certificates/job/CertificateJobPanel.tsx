import { type JobSummary, JobStatusEnum } from '@cert-it/shared';
import { Button, Group, List, Progress, Stack, Text } from '@mantine/core';
import {
  IconAlertTriangle,
  IconCircleCheck,
  IconLoader2,
} from '@tabler/icons-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MonoFigure } from '../../../app/layout/MonoFigure';
import { Surface } from '../../../app/layout/Surface';
import { isJobActive } from './isJobActive';

type CertificateJobPanelProps = {
  job: JobSummary;
  /** Whether the user may retry a failed job. */
  canRetry: boolean;
  onRetry: () => Promise<void>;
  onDismiss: () => void;
};

/** A certificate job's progress while it runs, then how many were issued and who was left out, or why it failed. */
export function CertificateJobPanel({
  job,
  canRetry,
  onRetry,
  onDismiss,
}: CertificateJobPanelProps) {
  const { t } = useTranslation();
  const [retrying, setRetrying] = useState(false);
  const active = isJobActive(job);
  const failed = job.status === JobStatusEnum.Failed;
  const skipped = job.output?.skipped ?? [];
  const total = job.total ?? 0;
  const percent = total > 0 ? (job.progress / total) * 100 : 0;

  const icon = active ? (
    <IconLoader2 size={18} stroke={1.5} />
  ) : failed ? (
    <IconAlertTriangle size={18} stroke={1.5} />
  ) : (
    <IconCircleCheck size={18} stroke={1.5} />
  );
  return (
    <Surface p="lg">
      <Stack gap="sm" aria-live="polite">
        <Group justify="space-between" wrap="nowrap" gap="sm">
          <Group gap="xs" wrap="nowrap">
            {icon}
            <Text fw={500}>
              {t(`certificateJob.titles.${job.type}.${job.status}`)}
            </Text>
          </Group>
          {!active && (
            <Group gap="xs" wrap="nowrap">
              {failed && canRetry && (
                <Button
                  size="xs"
                  variant="light"
                  loading={retrying}
                  onClick={() => {
                    setRetrying(true);
                    void onRetry().finally(() => setRetrying(false));
                  }}
                >
                  {t('certificateJob.retry')}
                </Button>
              )}
              <Button
                size="xs"
                variant="subtle"
                color="gray"
                onClick={onDismiss}
              >
                {t('certificateJob.dismiss')}
              </Button>
            </Group>
          )}
        </Group>

        {active && (
          <Stack gap="xs">
            {/* neutral, since the brand color is kept for actions and selection */}
            <Progress
              value={percent}
              color="gray"
              aria-label={t(`certificateJob.titles.${job.type}.${job.status}`)}
            />
            <MonoFigure>
              {t('certificateJob.progress', {
                progress: job.progress,
                total,
              })}
            </MonoFigure>
          </Stack>
        )}

        {failed && (
          <Text size="sm">
            {t('certificateJob.failedText', { error: job.error ?? '' })}
          </Text>
        )}

        {job.output && (
          <Text size="sm">
            {t('certificateJob.rendered', { count: job.output.rendered })}
          </Text>
        )}

        {skipped.length > 0 && (
          <Stack gap="xs">
            <Text size="sm" fw={500}>
              {t('certificateJob.skippedTitle', { count: skipped.length })}
            </Text>
            <Text size="sm" c="dimmed">
              {t('certificateJob.skippedText')}
            </Text>
            <List size="sm" spacing={4}>
              {skipped.map((participant) => (
                <List.Item key={participant.participantId}>
                  <Text span size="sm" fw={500}>
                    {participant.name}
                  </Text>
                  {participant.missingFields
                    && participant.missingFields.length > 0 && (
                      <Text span size="sm" c="dimmed">
                        {' · '}
                        {t('certificateJob.missingFields', {
                          fields: participant.missingFields.join(', '),
                        })}
                      </Text>
                    )}
                  {participant.missing.map((field) => (
                    <Text key={field.field} span size="sm" c="dimmed">
                      {' · '}
                      {t('certificateJob.missingCharacters', {
                        field: field.field,
                        characters: field.missing.join(' '),
                      })}
                    </Text>
                  ))}
                </List.Item>
              ))}
            </List>
          </Stack>
        )}
      </Stack>
    </Surface>
  );
}
