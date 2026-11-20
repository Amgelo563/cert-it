// runs in a worker thread, also unbundled in dev and tests: only erasable types and package imports here
import { readFile } from 'node:fs/promises';
import { parentPort, workerData } from 'node:worker_threads';
import { EncryptedPDFError, PDFDocument } from '@pdfme/pdf-lib';
import type { BasePdfProblem } from './BasePdfProblemEnum';

/** What the worker sends back: null when the file is a usable base PDF. */
export type BasePdfWorkerResult = { problem: BasePdfProblem | null };

async function check(path: string): Promise<BasePdfWorkerResult> {
  const bytes = await readFile(path);

  try {
    const document = await PDFDocument.load(bytes, { updateMetadata: false });
    return {
      problem: document.getPageCount() === 1 ? null : 'not_one_page',
    };
  } catch (error) {
    return {
      problem: error instanceof EncryptedPDFError ? 'encrypted' : 'invalid',
    };
  }
}

const { path } = workerData as { path: string };
parentPort!.postMessage(await check(path));
