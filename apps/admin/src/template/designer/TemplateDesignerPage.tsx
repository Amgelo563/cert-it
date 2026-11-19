import { ThemeValues } from '@cert-it/shared';
import { Stack } from '@mantine/core';
import { BLANK_A4_PDF, type Lang } from '@pdfme/common';
import { barcodes, text } from '@pdfme/schemas';
import { Designer } from '@pdfme/ui';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../app/layout/PageHeader';
import { Surface } from '../../app/layout/Surface';
import classes from './TemplateDesignerPage.module.css';

// antd theme of the Designer, with the same color and radius as the Mantine theme
const DesignerTheme = {
  token: {
    colorPrimary: ThemeValues.brandShades[ThemeValues.brandShadeIndex],
    // antd's controls are small, so a smaller radius than the cards
    borderRadius: 8,
    fontFamily: ThemeValues.fontFamily,
  },
};

// skeleton only: the field types are restricted and the course's base PDF loaded later
const Plugins = { text, qrcode: barcodes.qrcode };

/** The pdfme template Designer. Lazy-loaded: pdfme and antd only download on this page. */
export function TemplateDesignerPage() {
  const { t, i18n } = useTranslation();
  const container = useRef<HTMLDivElement>(null);
  const designer = useRef<Designer | null>(null);
  const lang = i18n.language as Lang;

  useEffect(() => {
    if (!container.current) return;

    const instance = new Designer({
      domContainer: container.current,
      template: { basePdf: BLANK_A4_PDF, schemas: [[]] },
      options: { lang, theme: DesignerTheme },
      plugins: Plugins,
    });
    designer.current = instance;

    return () => {
      instance.destroy();
      designer.current = null;
    };
    // created once; language changes go through updateOptions below
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    designer.current?.updateOptions({ lang });
  }, [lang]);

  return (
    <Stack gap="xl">
      <PageHeader
        title={t('templateDesigner.title')}
        description={t('templateDesigner.description')}
      />
      <Surface className={classes.designer}>
        <div ref={container} className={classes.container} />
      </Surface>
    </Stack>
  );
}
