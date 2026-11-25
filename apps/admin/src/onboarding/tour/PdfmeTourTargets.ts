/** Selectors of pdfme Designer elements tours point at; pdfme is pinned to an exact version, so they only change on purpose. */
export const PdfmeTourTargets = {
  /** The font picker among the selected field's settings, shown for text fields. */
  FontSetting: '.pdfme-designer-right-sidebar .ant-form-item:has(#fontName)',
  /** The panel with the fields or the selected field's settings, when open. */
  FieldPanel: '.pdfme-designer-right-sidebar',
  /** The button that opens and closes that panel. */
  PanelToggle: '.pdfme-designer-sidebar-toggle',
} as const;
