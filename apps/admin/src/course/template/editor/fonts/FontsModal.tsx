import type { FontSummary } from '@cert-it/shared';
import { Center, Loader, Modal, Tabs } from '@mantine/core';
import { IconDatabase, IconUpload, IconWorldSearch } from '@tabler/icons-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ApiRoutes } from '../../../../app/api/ApiClient';
import { useApiRequest } from '../../../../app/api/useApiRequest';
import { TourTargetEnum } from '../../../../onboarding/tour/TourTargetEnum';
import { CatalogNames } from './CatalogNames';
import { CatalogPanel } from './CatalogPanel';
import { StoredFontsPanel } from './StoredFontsPanel';
import { UploadFontPanel } from './UploadFontPanel';

const FontsTabEnum = {
  Stored: 'stored',
  Catalog: 'catalog',
  Upload: 'upload',
} as const;

// stable, so each request is sent once per opening
const fetchCatalog = (routes: ApiRoutes) =>
  routes['font-catalog'].$get({ query: {} });

// fetched on every opening, as other editors may add fonts
const fetchFonts = (routes: ApiRoutes) => routes.fonts.$get();

// about the tallest tab, so switching tabs doesn't resize the modal much
const PanelMinHeight = 400;

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

  // the contents live only while open, so each opening starts fresh
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t('template.fontsModal.title')}
      size="lg"
      // a fixed top, so a taller tab grows down instead of moving the modal
      centered={false}
      yOffset="8vh"
    >
      <div data-tour={TourTargetEnum.FontsModal}>
        <FontsTabs {...props} />
      </div>
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
  const stored = useApiRequest(fetchFonts);
  const catalogRequest = useApiRequest(fetchCatalog);
  // which catalog the site uses, if any; a catalog that's down hides its tab
  const catalog = catalogRequest.data?.catalog;
  const [picked, setTab] = useState<FontsTab | null>(null);
  const settled = !stored.loading && !catalogRequest.loading;

  if (!picked && !settled) {
    return (
      <Center mih={PanelMinHeight}>
        <Loader size="sm" aria-label={t('app.loading')} />
      </Center>
    );
  }
  // with no fonts to pick yet, starts where new ones come from
  const hasFonts = loaded.length > 0 || (stored.data?.length ?? 0) > 0;
  const tab =
    picked
    ?? (hasFonts
      ? FontsTabEnum.Stored
      : catalog
        ? FontsTabEnum.Catalog
        : FontsTabEnum.Upload);

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

      <Tabs.Panel value={FontsTabEnum.Stored} mih={PanelMinHeight}>
        <StoredFontsPanel
          stored={stored}
          loaded={loaded}
          busy={busy}
          onAdd={(font) => void onAdd(font)}
          onRemove={onRemove}
        />
      </Tabs.Panel>
      {catalog && (
        <Tabs.Panel value={FontsTabEnum.Catalog} mih={PanelMinHeight}>
          <CatalogPanel
            onImported={(font, bytes) => {
              onImported(font, bytes);
              showStored();
            }}
          />
        </Tabs.Panel>
      )}
      <Tabs.Panel value={FontsTabEnum.Upload} mih={PanelMinHeight}>
        <UploadFontPanel
          busy={busy}
          onUpload={(file) => void onUpload(file).then(showStored)}
        />
      </Tabs.Panel>
    </Tabs>
  );
}
