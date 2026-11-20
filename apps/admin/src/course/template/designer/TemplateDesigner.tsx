import { ThemeValues } from '@cert-it/shared';
import type { Font, Lang, Template } from '@pdfme/common';
import { barcodes, text } from '@pdfme/schemas';
import { Designer } from '@pdfme/ui';
import { type Ref, useEffect, useImperativeHandle, useRef } from 'react';
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

/** What the Designer lets its parent do. */
export type TemplateDesignerHandle = {
  /** Returns the template as it is on the canvas, with the editor's changes. */
  getTemplate: () => Template;
};

type TemplateDesignerProps = {
  ref?: Ref<TemplateDesignerHandle>;
  /** The template to show; a new value replaces what's on the canvas. */
  template: Template;
  /** Fonts by the name text fields use; one of them is the fallback. */
  fonts: Font;
  /** Called once the Designer is created, with the template as it loaded it. */
  onLoad?: (template: Template) => void;
  /** Called on every change to the template, by the editor or a new `template`. */
  onChange?: (template: Template) => void;
};

/** The pdfme Designer, themed like the panel and following its language. */
export function TemplateDesigner({
  ref,
  template,
  fonts,
  onLoad,
  onChange,
}: TemplateDesignerProps) {
  const { i18n } = useTranslation();
  const container = useRef<HTMLDivElement>(null);
  const designer = useRef<Designer | null>(null);
  const lang = i18n.language as Lang;
  // the latest callbacks, since the Designer keeps the first ones it gets
  const callbacks = useRef({ onLoad, onChange });
  callbacks.current = { onLoad, onChange };
  // the template the Designer was created with, which needs no update
  const loaded = useRef<Template | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      getTemplate: () => {
        if (!designer.current) throw new Error('The Designer is not ready');
        return designer.current.getTemplate();
      },
    }),
    [],
  );

  useEffect(() => {
    if (!container.current) return;

    const instance = new Designer({
      domContainer: container.current,
      template,
      options: { lang, theme: DesignerTheme, ...fontOption(fonts) },
      plugins: Plugins,
    });
    designer.current = instance;
    loaded.current = template;
    instance.onChangeTemplate((changed) =>
      callbacks.current.onChange?.(changed),
    );
    callbacks.current.onLoad?.(instance.getTemplate());

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
    if (template === loaded.current) return;
    loaded.current = template;
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
