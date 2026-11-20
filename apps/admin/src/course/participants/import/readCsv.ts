import Papa from 'papaparse';
import type { CsvRow, CsvTable } from './CsvTable';

const Delimiters = [',', ';', '\t', '|'];

/**
 * Decodes a CSV file's bytes and splits it into a header and rows, skipping empty lines.
 *
 * UTF-8 is tried first; files that aren't valid UTF-8 are read as Windows-1252, as Excel saves them on Windows.
 */
export function readCsv(bytes: ArrayBuffer): CsvTable {
  const text = decode(bytes);
  const { data } = Papa.parse<string[]>(text, {
    delimiter: guessDelimiter(text),
    skipEmptyLines: false,
  });
  const lines = data
    .map((cells, index) => ({
      line: index + 1,
      cells: cells.map((cell) => cell.trim()),
    }))
    .filter(({ cells }) => cells.some((cell) => cell !== ''));

  const [header, ...rows] = lines;
  if (!header) return { headers: [], rows: [] };

  return {
    headers: header.cells,
    rows: rows.map((row): CsvRow => ({
      line: row.line,
      cells: header.cells.map((_, index) => row.cells[index] ?? ''),
    })),
  };
}

// the most common candidate in the first line: Excel uses ; where , is the decimal separator
function guessDelimiter(text: string): string {
  const firstLine =
    text.split(/\r?\n/).find((line) => line.trim() !== '') ?? '';
  const counts = Delimiters.map(
    (delimiter) => firstLine.split(delimiter).length - 1,
  );
  const best = counts.indexOf(Math.max(...counts));
  return counts[best] === 0 ? ',' : (Delimiters[best] ?? ',');
}

// the BOM Excel adds to UTF-8 files is dropped by the decoder
function decode(bytes: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}
