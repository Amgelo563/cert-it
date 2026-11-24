import type { CatalogFamilySummary, FontSummary } from '@cert-it/shared';
import {
  Alert,
  Button,
  Center,
  Group,
  Loader,
  ScrollArea,
  Select,
  Stack,
  Text,
  TextInput,
  UnstyledButton,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { IconAlertCircle, IconSearch } from '@tabler/icons-react';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ApiRoutes } from '../../../../app/api/ApiClient';
import { describeApiError } from '../../../../app/api/describeApiError';
import { useApiClient } from '../../../../app/api/useApiClient';
import { useApiRequest } from '../../../../app/api/useApiRequest';
import classes from './FontsModal.module.css';
import { FontPreviewText } from './FontPreviewText';

/** Called with an imported font and its bytes. */
type ImportedListener = (font: FontSummary, bytes: ArrayBuffer) => void;

// latin covers Spanish and English names, so it's picked when there
const PreferredSubset = 'latin';

const SearchDelayMs = 300;

type CatalogPanelProps = {
  onImported: ImportedListener;
};

/** Searches the online font catalog and imports a family's style; the server downloads and stores it. */
export function CatalogPanel({ onImported }: CatalogPanelProps) {
  const { t, i18n } = useTranslation();
  const api = useApiClient();
  const [query, setQuery] = useState('');
  const [search] = useDebouncedValue(query.trim(), SearchDelayMs);
  const [picked, setPicked] = useState<CatalogFamilySummary | null>(null);
  const [variant, setVariant] = useState<string | null>(null);
  const [subset, setSubset] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<unknown>(null);

  const request = useApiRequest(
    useCallback(
      (routes: ApiRoutes) => routes['font-catalog'].$get({ query: { search } }),
      [search],
    ),
  );
  const pending = request.loading || query.trim() !== search;
  const families = pending ? null : (request.data?.families ?? null);
  const error = importError ?? request.error;

  // drop the pick once the shown list no longer has it
  const listed =
    picked !== null && families?.some((f) => f.id === picked.id) === true;
  if (picked !== null && families !== null && !listed) setPicked(null);
  const selected = listed ? picked : null;

  const pick = (family: CatalogFamilySummary) => {
    setPicked(family);
    const regular =
      family.variants.find((v) => v.weight === 400 && !v.italic)
      ?? family.variants[0];
    setVariant(regular ? variantKey(regular) : null);
    setSubset(
      family.subsets.includes(PreferredSubset)
        ? PreferredSubset
        : (family.subsets[0] ?? null),
    );
  };

  const importFont = async () => {
    if (!selected || !variant) return;
    const [weight = '400', style] = variant.split(':');
    setImporting(true);
    setImportError(null);
    try {
      const font = await api.request((routes) =>
        routes['font-catalog'].import.$post({
          json: {
            id: selected.id,
            weight: Number(weight),
            italic: style === 'italic',
            ...(subset ? { subset } : {}),
          },
        }),
      );
      const bytes = await api.requestBytes((routes) =>
        routes.fonts[':sha256'].$get({ param: { sha256: font.sha256 } }),
      );
      onImported(font, bytes);
      setPicked(null);
    } catch (caught) {
      setImportError(caught);
    } finally {
      setImporting(false);
    }
  };

  const variantLabel = (key: string) => {
    const [weight, style] = key.split(':');
    return style === 'italic'
      ? t('template.catalog.italicWeight', { weight })
      : t('template.catalog.weight', { weight });
  };

  return (
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
      <TextInput
        value={query}
        onChange={(event) => setQuery(event.currentTarget.value)}
        placeholder={t('template.catalog.searchPlaceholder')}
        leftSection={<IconSearch size={16} stroke={1.5} />}
        data-autofocus
      />
      <ScrollArea.Autosize mah={260}>
        {families === null && request.error === null && (
          <Center py="lg">
            <Loader size="sm" />
          </Center>
        )}
        {families?.length === 0 && (
          <Text size="sm" c="dimmed" py="md" ta="center">
            {t('template.catalog.noResults')}
          </Text>
        )}
        <Stack gap={2}>
          {families?.map((family) => (
            <UnstyledButton
              key={family.id}
              className={classes.family}
              data-active={selected?.id === family.id || undefined}
              aria-pressed={selected?.id === family.id}
              onClick={() => pick(family)}
            >
              <Group justify="space-between" wrap="nowrap">
                <Text size="sm" fw={500}>
                  {family.family}
                </Text>
                <Text size="xs" c="dimmed">
                  {family.category}
                </Text>
              </Group>
            </UnstyledButton>
          ))}
        </Stack>
      </ScrollArea.Autosize>
      {selected && (
        <Group grow align="flex-start">
          <Select
            label={t('template.catalog.style')}
            description={t('template.catalog.styleHint')}
            value={variant}
            onChange={setVariant}
            allowDeselect={false}
            data={selected.variants.map((v) => {
              const key = variantKey(v);
              return { value: key, label: variantLabel(key) };
            })}
          />
          {selected.subsets.length > 1 && (
            <Select
              label={t('template.catalog.subset')}
              description={t('template.catalog.subsetHint')}
              value={subset}
              onChange={setSubset}
              allowDeselect={false}
              data={[...selected.subsets]}
            />
          )}
        </Group>
      )}
      {selected && variant && (
        <CatalogPreview
          id={selected.id}
          variant={variant}
          subset={subset}
          text={t('template.sampleName')}
        />
      )}
      <Group justify="flex-end" gap="sm">
        <Button
          onClick={() => void importFont()}
          disabled={!selected || !variant}
          loading={importing}
        >
          {t('template.catalog.import')}
        </Button>
      </Group>
    </Stack>
  );
}

function variantKey(variant: { weight: number; italic: boolean }): string {
  return `${variant.weight}:${variant.italic ? 'italic' : 'normal'}`;
}

type CatalogPreviewProps = {
  id: string;
  /** The style, as `weight:italic` or `weight:normal`. */
  variant: string;
  subset: string | null;
  text: string;
};

// the sample name in the picked style, drawn by the server, which downloads it without storing it
function CatalogPreview({ id, variant, subset, text }: CatalogPreviewProps) {
  const { t } = useTranslation();
  const request = useApiRequest(
    useCallback(
      (routes: ApiRoutes) => {
        const [weight = '400', style] = variant.split(':');
        return routes['font-catalog'].preview.$get({
          query: {
            id,
            weight,
            italic: style === 'italic' ? 'true' : 'false',
            text,
            ...(subset ? { subset } : {}),
          },
        });
      },
      [id, variant, subset, text],
    ),
  );

  return (
    <Stack gap={4}>
      <Text size="sm" fw={500}>
        {t('template.catalog.preview')}
      </Text>
      <Center className={classes.preview} mih={64}>
        {request.loading ? (
          <Loader size="sm" />
        ) : (
          <FontPreviewText
            preview={request.error === null ? request.data : null}
            label={text}
            height={40}
          />
        )}
      </Center>
    </Stack>
  );
}
