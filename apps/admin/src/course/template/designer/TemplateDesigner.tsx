import { ThemeValues } from '@cert-it/shared';
import type { Font, Lang, Template } from '@pdfme/common';
import { barcodes, text } from '@pdfme/schemas';
import { Designer } from '@pdfme/ui';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Surface } from '../../../app/layout/Surface';
import classes from './TemplateDesigner.module.css';

// antd theme of the Designer, with the same color and radius as the Mantine theme
const DesignerTheme = {
  token: {
    colorPrimary: ThemeValues.brandShades[ThemeValues.brandShadeIndex],
    // antd's controls are small, so a smaller radius than the cards
    borderRadius: 8,
    fontFamily: ThemeValues.fontFamily,
  },
};

// not yet the course's field types
const Plugins = { text, qrcode: barcodes.qrcode };

// pdfme refuses a font map without a fallback, so none keeps its own default
function fontOption(fonts: Font): { font?: Font } {
  return Object.keys(fonts).length > 0 ? { font: fonts } : {};
}

type TemplateDesignerProps = {
  /** The template to show; a new value replaces what's on the canvas. */
  template: Template;
  /** Fonts by the name text fields use; one of them is the fallback. */
  fonts: Font;
};

/** The pdfme Designer, themed like the panel and following its language. */
export function TemplateDesigner({ template, fonts }: TemplateDesignerProps) {
  const { i18n } = useTranslation();
  const container = useRef<HTMLDivElement>(null);
  const designer = useRef<Designer | null>(null);
  const lang = i18n.language as Lang;

  useEffect(() => {
    if (!container.current) return;

    const instance = new Designer({
      domContainer: container.current,
      template,
      options: { lang, theme: DesignerTheme, ...fontOption(fonts) },
      plugins: Plugins,
    });
    designer.current = instance;

    return () => {
      instance.destroy();
      designer.current = null;
    };
    // created once; later changes go through the effects below
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // fonts first, so a new template's fields find theirs
  useEffect(() => {
    designer.current?.updateOptions(fontOption(fonts));
  }, [fonts]);

  useEffect(() => {
    designer.current?.updateTemplate(template);
  }, [template]);

  useEffect(() => {
    designer.current?.updateOptions({ lang });
  }, [lang]);

  return (
    <Surface className={classes.designer}>
      <div ref={container} className={classes.container} />
    </Surface>
  );
}
