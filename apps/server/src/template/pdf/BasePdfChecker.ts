import { Worker } from 'node:worker_threads';
import { Result } from 'better-result';
import type { BasePdfWorkerResult } from './basePdfWorker';
import { InvalidBasePdfError } from './InvalidBasePdfError';

type BasePdfCheckerOptions = {
  /** @default the basePdfWorker file next to this module, .ts from source or .mjs when bundled */
  workerUrl?: URL;
  /** Heap limit of the worker. @default BasePdfChecker.DefaultMaxHeapMb */
  maxHeapMb?: number;
  /** @default BasePdfChecker.DefaultTimeoutMs */
  timeoutMs?: number;
};

/** Checks that a file is a usable base PDF: a PDF, unencrypted, with one page. Parses it in a worker thread with its own small heap, so a large PDF can't swell the server's. */
export class BasePdfChecker {
  public static readonly DefaultMaxHeapMb = 64;

  public static readonly DefaultTimeoutMs = 30_000;

  protected readonly workerUrl: URL;

  protected readonly maxHeapMb: number;

  protected readonly timeoutMs: number;

  constructor(options: BasePdfCheckerOptions = {}) {
    this.workerUrl = options.workerUrl ?? BasePdfChecker.defaultWorkerUrl();
    this.maxHeapMb = options.maxHeapMb ?? BasePdfChecker.DefaultMaxHeapMb;
    this.timeoutMs = options.timeoutMs ?? BasePdfChecker.DefaultTimeoutMs;
  }

  /**
   * Checks the PDF at the given path.
   *
   * @throws {Error} If the worker fails, runs out of memory or takes longer than the timeout.
   */
  public async check(path: string): Promise<Result<void, InvalidBasePdfError>> {
    const { problem } = await this.runWorker(path);
    return problem
      ? Result.err(new InvalidBasePdfError({ problem }))
      : Result.ok(undefined);
  }

  protected runWorker(path: string): Promise<BasePdfWorkerResult> {
    const worker = new Worker(this.workerUrl, {
      workerData: { path },
      // not the parent's flags, such as a dev watcher's
      execArgv: [],
      resourceLimits: { maxOldGenerationSizeMb: this.maxHeapMb },
    });

    return new Promise<BasePdfWorkerResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`The PDF check took over ${this.timeoutMs} ms.`));
        void worker.terminate();
      }, this.timeoutMs);

      worker.once('message', (result: BasePdfWorkerResult) => {
        clearTimeout(timer);
        resolve(result);
      });
      worker.once('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
      worker.once('exit', (code) => {
        clearTimeout(timer);
        reject(new Error(`The PDF check stopped with exit code ${code}.`));
      });
    });
  }

  // bundled, the worker is its own entry next to the main file
  protected static defaultWorkerUrl(): URL {
    const extension = import.meta.url.endsWith('.ts') ? 'ts' : 'mjs';
    return new URL(`./basePdfWorker.${extension}`, import.meta.url);
  }
}
