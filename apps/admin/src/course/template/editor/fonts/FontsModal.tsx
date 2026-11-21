import type { FontSummary } from '@cert-it/shared';
import { Modal, Tabs } from '@mantine/core';
import { IconDatabase, IconUpload, IconWorldSearch } from '@tabler/icons-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ApiRoutes } from '../../../../app/api/ApiClient';
import { useApiRequest } from '../../../../app/api/useApiRequest';
import { CatalogNames } from './CatalogNames';
import { CatalogPanel } from './CatalogPanel';
import { StoredFontsPanel } from './StoredFontsPanel';
import { UploadFontPanel } from './UploadFontPanel';

const FontsTabEnum = {
  Stored: 'stored',
  Catalog: 'catalog',
  Upload: 'upload',
} as const;

// stable, so the request is sent once per opening
const fetchCatalog = (routes: ApiRoutes) =>
  routes['font-catalog'].$get({ query: {} });

type FontsTab = (typeof FontsTabEnum)[keyof typeof FontsTabEnum];

type FontsModalProps = {
  opened: boolean;
  onClose: () => void;
  /** The fonts in the template. */
  loaded: readonly FontSummary[];
  /** Whether a font is being added or uploaded. */
  busy: boolean;
  /** Adds a stored font; resolves once it's in the template. */
  onAdd: (font: FontSummary) => Promise<unknown>;
  onRemove: (font: FontSummary) => void;
  onUpload: (file: File) => Promise<unknown>;
  /** Called with a font imported from the catalog and its bytes. */
  onImported: (font: FontSummary, bytes: ArrayBuffer) => void;
};

/** The template's fonts in one place: pick stored ones, import from the catalog, or upload a file. */
export function FontsModal({ opened, onClose, ...props }: FontsModalProps) {
  const { t } = useTranslation();

  // the contents live only while open, so each opening starts on the stored fonts, up to date
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t('template.fontsModal.title')}
      size="lg"
    >
      <FontsTabs {...props} />
    </Modal>
  );
}

function FontsTabs({
  loaded,
  busy,
  onAdd,
  onRemove,
  onUpload,
  onImported,
}: Omit<FontsModalProps, 'opened' | 'onClose'>) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<FontsTab>(FontsTabEnum.Stored);
  // which catalog the site uses, if any; a catalog that's down hides its tab
  const catalog = useApiRequest(fetchCatalog).data?.catalog;

  // a new font shows among the stored ones, already ticked
  const showStored = () => setTab(FontsTabEnum.Stored);

  return (
    <Tabs
      value={tab}
      onChange={(value) => value && setTab(value as FontsTab)}
      keepMounted={false}
    >
      <Tabs.List mb="md">
        <Tabs.Tab
          value={FontsTabEnum.Stored}
          leftSection={<IconDatabase size={16} stroke={1.5} />}
        >
          {t('template.fontsModal.stored')}
        </Tabs.Tab>
        {catalog && (
          <Tabs.Tab
            value={FontsTabEnum.Catalog}
            leftSection={<IconWorldSearch size={16} stroke={1.5} />}
          >
            {CatalogNames[catalog] ?? catalog}
          </Tabs.Tab>
        )}
        <Tabs.Tab
          value={FontsTabEnum.Upload}
          leftSection={<IconUpload size={16} stroke={1.5} />}
        >
          {t('template.fontsModal.upload')}
        </Tabs.Tab>
      </Tabs.List>

      <Tabs.Panel value={FontsTabEnum.Stored}>
        <StoredFontsPanel
          loaded={loaded}
          busy={busy}
          onAdd={(font) => void onAdd(font)}
          onRemove={onRemove}
        />
      </Tabs.Panel>
      {catalog && (
        <Tabs.Panel value={FontsTabEnum.Catalog}>
          <CatalogPanel
            onImported={(font, bytes) => {
              onImported(font, bytes);
              showStored();
            }}
          />
        </Tabs.Panel>
      )}
      <Tabs.Panel value={FontsTabEnum.Upload}>
        <UploadFontPanel
          busy={busy}
          onUpload={(file) => void onUpload(file).then(showStored)}
        />
      </Tabs.Panel>
    </Tabs>
  );
}
