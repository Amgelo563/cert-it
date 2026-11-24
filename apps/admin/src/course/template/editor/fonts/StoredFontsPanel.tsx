import type { FontSummary } from '@cert-it/shared';
import {
  Alert,
  Center,
  Checkbox,
  Loader,
  ScrollArea,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { useInViewport } from '@mantine/hooks';
import { IconAlertCircle, IconSearch } from '@tabler/icons-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { describeApiError } from '../../../../app/api/describeApiError';
import type { ApiRequestState } from '../../../../app/api/useApiRequest';
import { FontPreviewText } from './FontPreviewText';
import { StoredFontPreview } from './StoredFontPreview';

type StoredFontsPanelProps = {
  /** The fonts in the template, which show first. */
  loaded: readonly FontSummary[];
  /** Whether a font is being added, so the list waits. */
  busy: boolean;
  onAdd: (font: FontSummary) => void;
  onRemove: (font: FontSummary) => void;
  /** Every stored font, fetched by the modal on each opening. */
  stored: ApiRequestState<readonly FontSummary[]>;
};

const fontLabel = (font: FontSummary) => `${font.family} ${font.style}`;

/** Every stored font, searchable, with a checkbox that adds it to the template or takes it out. */
export function StoredFontsPanel({
  loaded,
  busy,
  onAdd,
  onRemove,
  stored: request,
}: StoredFontsPanelProps) {
  const { t, i18n } = useTranslation();
  const [query, setQuery] = useState('');

  const search = query.trim().toLowerCase();
  const matches = (font: FontSummary) =>
    fontLabel(font).toLowerCase().includes(search);
  const loadedIds = new Set(loaded.map((font) => font.sha256));
  const inTemplate = loaded.filter(matches);
  const others = request.data?.filter(
    (font) => !loadedIds.has(font.sha256) && matches(font),
  );

  if (request.error !== null && !request.data) {
    return (
      <Alert
        color="red"
        variant="light"
        icon={<IconAlertCircle size={18} stroke={1.5} />}
      >
        {describeApiError(request.error, i18n)}
      </Alert>
    );
  }

  const row = (font: FontSummary, checked: boolean) => (
    <Checkbox
      key={font.sha256}
      checked={checked}
      disabled={busy}
      onChange={() => (checked ? onRemove(font) : onAdd(font))}
      aria-label={fontLabel(font)}
      label={<LazyFontPreview font={font} />}
      styles={{ body: { alignItems: 'center' } }}
    />
  );

  return (
    <Stack gap="md">
      <TextInput
        value={query}
        onChange={(event) => setQuery(event.currentTarget.value)}
        placeholder={t('template.fontsModal.searchStored')}
        leftSection={<IconSearch size={16} stroke={1.5} />}
        data-autofocus
      />
      <ScrollArea.Autosize mah={360}>
        <Stack gap="lg">
          {inTemplate.length > 0 && (
            <Stack gap="xs">
              <Text size="xs" fw={500} c="dimmed">
                {t('template.fontsModal.inTemplate')}
              </Text>
              {inTemplate.map((font) => row(font, true))}
            </Stack>
          )}
          <Stack gap="xs">
            <Text size="xs" fw={500} c="dimmed">
              {t('template.fontsModal.otherStored')}
            </Text>
            {!others && (
              <Center py="md">
                <Loader size="sm" />
              </Center>
            )}
            {others?.length === 0 && (
              <Text size="sm" c="dimmed">
                {search
                  ? t('template.fontsModal.noMatches')
                  : t('template.noStoredFonts')}
              </Text>
            )}
            {others?.map((font) => row(font, false))}
          </Stack>
        </Stack>
      </ScrollArea.Autosize>
    </Stack>
  );
}

// asks for the preview only once the row scrolls into view, so a long list costs no more than a short one
function LazyFontPreview({ font }: { font: FontSummary }) {
  const { ref, inViewport } = useInViewport();

  return (
    <div ref={ref}>
      {inViewport ? (
        <StoredFontPreview font={font} />
      ) : (
        <FontPreviewText preview={null} label={fontLabel(font)} height={22} />
      )}
    </div>
  );
}
