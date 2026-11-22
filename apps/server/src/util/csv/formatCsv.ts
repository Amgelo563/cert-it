import { CsvByteOrderMark } from './CsvByteOrderMark';

// a spreadsheet runs a cell starting with these as a formula
const FormulaStart = /^[=+\-@\t\r]/;

const NeedsQuotes = /[",\r\n]/;

/**
 * Returns rows as CSV text for spreadsheets: comma separated, CRLF line ends and a UTF-8 byte order mark, so Excel reads accents.
 *
 * Cells that a spreadsheet would run as a formula get a leading apostrophe, since names come from imported files.
 */
export function formatCsv(rows: readonly (readonly string[])[]): string {
  const lines = rows.map((row) => row.map(formatCell).join(','));
  return `${CsvByteOrderMark}${lines.join('\r\n')}\r\n`;
}

function formatCell(value: string): string {
  const safe = FormulaStart.test(value) ? `'${value}` : value;
  return NeedsQuotes.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}
