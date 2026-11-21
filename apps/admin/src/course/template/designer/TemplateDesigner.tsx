import { ThemeValues } from '@cert-it/shared';
import type { Font, Lang, Plugins, Template } from '@pdfme/common';
import { Designer } from '@pdfme/ui';
import { type Ref, useEffect, useImperativeHandle, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Surface } from '../../../app/layout/Surface';
import { nameNewField } from './nameNewField';
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

// pdfme refuses a font map without a fallback, so none keeps its own default
function fontOption(fonts: Font): { font?: Font } {
  return Object.keys(fonts).length > 0 ? { font: fonts } : {};
}

// after pdfme's own attempt to select the new field, which runs on the next tick
const FieldSelectDelayMs = 50;

function fieldNamesOf(template: Template): Set<string> {
  return new Set(template.schemas.flat().map((field) => field.name));
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
  /** The field types editors can place, keyed by their label; a new value restarts the Designer, keeping the canvas. */
  plugins: Plugins;
  /** Name for each field type, given to new fields in place of pdfme's field1, field2. */
  fieldNames?: Readonly<Record<string, string>>;
  /** Called once the Designer is first created, with the template as it loaded it. */
  onLoad?: (template: Template) => void;
  /** Called on every change to the template, by the editor or a new `template`. */
  onChange?: (template: Template) => void;
};

/** The pdfme Designer, themed like the panel and following its language. */
export function TemplateDesigner({
  ref,
  template,
  fonts,
  plugins,
  fieldNames = {},
  onLoad,
  onChange,
}: TemplateDesignerProps) {
  const { i18n } = useTranslation();
  const container = useRef<HTMLDivElement>(null);
  const designer = useRef<Designer | null>(null);
  const lang = i18n.language as Lang;
  // the latest callbacks, since the Designer keeps the first ones it gets
  const callbacks = useRef({ onLoad, onChange, fieldNames });
  useEffect(() => {
    callbacks.current = { onLoad, onChange, fieldNames };
  });
  // the `template` prop last applied, which needs no update
  const applied = useRef<Template | null>(null);
  // the canvas when the Designer stopped, for the next one to start from
  const canvas = useRef<Template | null>(null);

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

  // pdfme takes its field types only when created, so new ones mean a new Designer
  useEffect(() => {
    if (!container.current) return;

    const first = applied.current === null;
    if (first) applied.current = template;
    const instance = new Designer({
      domContainer: container.current,
      template: canvas.current ?? template,
      options: { lang, theme: DesignerTheme, ...fontOption(fonts) },
      plugins,
    });
    designer.current = instance;
    let names = fieldNamesOf(instance.getTemplate());
    instance.onChangeTemplate((changed) => {
      const named = nameNewField(changed, names, callbacks.current.fieldNames);
      names = fieldNamesOf(named?.template ?? changed);
      if (!named) {
        callbacks.current.onChange?.(changed);
        return;
      }

      // reports the renamed template; pdfme then selects the field by its old id, so it's selected again after
      instance.updateTemplate(named.template);
      setTimeout(() => instance.selectSchemas(named.name), FieldSelectDelayMs);
    });
    if (first) callbacks.current.onLoad?.(instance.getTemplate());

    return () => {
      canvas.current = instance.getTemplate();
      instance.destroy();
      designer.current = null;
    };
    // the other props reach a running Designer through the effects below
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [plugins]);

  // fonts first, so a new template's fields find theirs
  useEffect(() => {
    designer.current?.updateOptions(fontOption(fonts));
  }, [fonts]);

  useEffect(() => {
    if (template === applied.current) return;
    applied.current = template;
    canvas.current = null;
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
