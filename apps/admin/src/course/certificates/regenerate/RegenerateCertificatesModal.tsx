import type { JobSummary, OutdatedCertificates } from '@cert-it/shared';
import {
  Alert,
  Button,
  Checkbox,
  Group,
  Modal,
  ScrollArea,
  Stack,
  Text,
} from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { describeApiError } from '../../../app/api/describeApiError';
import { useApiClient } from '../../../app/api/useApiClient';
import { MonoFigure } from '../../../app/layout/MonoFigure';

type RegenerateCertificatesModalProps = {
  opened: boolean;
  courseId: number;
  outdated: OutdatedCertificates;
  onClose: () => void;
  onRegenerated: (job: JobSummary) => void;
};

/** Asks which certificates on an older template to render again with the latest one: all, some or none. */
export function RegenerateCertificatesModal({
  opened,
  courseId,
  outdated,
  onClose,
  onRegenerated,
}: RegenerateCertificatesModalProps) {
  const { t, i18n } = useTranslation();
  const api = useApiClient();
  // unchecked ones, so every certificate starts checked
  const [unchecked, setUnchecked] = useState<ReadonlySet<number>>(new Set());
  const [error, setError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);
  const { items } = outdated;
  const checked = items.filter(({ id }) => !unchecked.has(id));

  // the next opening starts with everything checked
  const close = () => {
    setUnchecked(new Set());
    setError(null);
    onClose();
  };

  const toggle = (id: number) =>
    setUnchecked((previous) => {
      const next = new Set(previous);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const job = await api.request((routes) =>
        routes.courses[':courseId'].certificates.regenerate.$post({
          param: { courseId: String(courseId) },
          // everything on an older version, unless some were unchecked
          json:
            checked.length === items.length
              ? {}
              : { certificateIds: checked.map(({ id }) => id) },
        }),
      );
      setUnchecked(new Set());
      onRegenerated(job);
    } catch (caught) {
      setError(caught);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={close}
      title={t('regenerate.title')}
      size="lg"
    >
      <Stack gap="md">
        {error !== null && (
          <Alert
            color="red"
            variant="light"
            icon={<IconAlertCircle size={18} stroke={1.5} />}
          >
            {describeApiError(error, i18n)}
          </Alert>
        )}
        <Text size="sm">
          {t('regenerate.text', {
            count: items.length,
            version: outdated.latestVersion ?? '',
          })}
        </Text>
        <Checkbox
          label={t('regenerate.selectAll')}
          checked={checked.length === items.length}
          indeterminate={checked.length > 0 && checked.length < items.length}
          onChange={() =>
            setUnchecked(
              checked.length === items.length
                ? new Set(items.map(({ id }) => id))
                : new Set(),
            )
          }
        />
        <ScrollArea.Autosize mah={320}>
          <Stack gap="xs">
            {items.map((certificate) => (
              <Group key={certificate.id} gap="sm" wrap="nowrap">
                <Checkbox
                  checked={!unchecked.has(certificate.id)}
                  onChange={() => toggle(certificate.id)}
                  aria-label={t('regenerate.select', {
                    name: certificate.name,
                  })}
                />
                <Text size="sm" flex={1} truncate>
                  {certificate.name}
                </Text>
                <MonoFigure>{certificate.code}</MonoFigure>
                <MonoFigure>
                  {t('regenerate.fromVersion', {
                    version: certificate.templateVersion,
                  })}
                </MonoFigure>
              </Group>
            ))}
          </Stack>
        </ScrollArea.Autosize>
        <Group justify="flex-end" mt="xs">
          <Button variant="subtle" color="gray" onClick={close}>
            {t('regenerate.notNow')}
          </Button>
          <Button
            loading={submitting}
            disabled={checked.length === 0}
            onClick={() => void submit()}
          >
            {t('regenerate.submit', { count: checked.length })}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
