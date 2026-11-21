// Tabler icon as SVG markup, sized since pdfme's sidebar doesn't
function tablerSvg(paths: readonly string[]): string {
  const body = paths.map((d) => `<path d="${d}"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}

/** Sidebar icon of participant name fields. */
export const ParticipantNameIcon = tablerSvg([
  'M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0',
  'M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2',
]);

/** Sidebar icon of issue date fields. */
export const IssueDateIcon = tablerSvg([
  'M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2l0 -12',
  'M16 3l0 4',
  'M8 3l0 4',
  'M4 11l16 0',
  'M8 15h2v2h-2l0 -2',
]);

/** Sidebar icon of QR code fields. */
export const QrCodeIcon = tablerSvg([
  'M4 5a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4',
  'M7 17l0 .01',
  'M14 5a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4',
  'M7 7l0 .01',
  'M4 15a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4',
  'M17 7l0 .01',
  'M14 14l3 0',
  'M20 14l0 .01',
  'M14 14l0 3',
  'M14 20l3 0',
  'M17 17l3 0',
  'M20 17l0 3',
]);
