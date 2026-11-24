import { Worker } from 'node:worker_threads';
import { Result } from 'better-result';
import type { BasePdfWorkerResult } from './basePdfWorker';
import { InvalidBasePdfError } from './InvalidBasePdfError';

type BasePdfCheckerOptions = {
  /** @default the basePdfWorker file next to this module, .ts from source or .mjs when bundled */
  workerUrl?: URL;
  /** Heap limit of the worker. @default BasePdfChecker.DefaultMaxHeapMb */
  maxHeapMb?: number;
  /** Young generation limit of the worker, which the heap limit leaves out. @default BasePdfChecker.DefaultMaxYoungMb */
  maxYoungMb?: number;
  /** @default BasePdfChecker.DefaultTimeoutMs */
  timeoutMs?: number;
  /** Workers allowed at once, later checks wait for a free slot. @default BasePdfChecker.DefaultMaxConcurrent */
  maxConcurrent?: number;
};

/** Checks that a file is a usable base PDF: a PDF, unencrypted, with one page. Parses it in a worker thread with its own small heap, so a large PDF can't swell the server's. Caps how many workers run at once, so parallel uploads can't add up past the container's memory. */
export class BasePdfChecker {
  public static readonly DefaultMaxHeapMb = 64;

  public static readonly DefaultMaxYoungMb = 16;

  public static readonly DefaultTimeoutMs = 30_000;

  public static readonly DefaultMaxConcurrent = 2;

  protected readonly workerUrl: URL;

  protected readonly maxHeapMb: number;

  protected readonly maxYoungMb: number;

  protected readonly timeoutMs: number;

  protected readonly maxConcurrent: number;

  protected running = 0;

  protected readonly waiting: (() => void)[] = [];

  constructor(options: BasePdfCheckerOptions) {
    this.workerUrl = options.workerUrl ?? BasePdfChecker.defaultWorkerUrl();
    this.maxHeapMb = options.maxHeapMb ?? BasePdfChecker.DefaultMaxHeapMb;
    this.maxYoungMb = options.maxYoungMb ?? BasePdfChecker.DefaultMaxYoungMb;
    this.timeoutMs = options.timeoutMs ?? BasePdfChecker.DefaultTimeoutMs;
    this.maxConcurrent = Math.max(
      1,
      options.maxConcurrent ?? BasePdfChecker.DefaultMaxConcurrent,
    );
  }

  public static create(options?: {
    injections?: Partial<BasePdfCheckerOptions>;
  }): BasePdfChecker {
    return new BasePdfChecker({ ...options?.injections });
  }

  // bundled, the worker is its own entry next to the main file
  protected static defaultWorkerUrl(): URL {
    const extension = import.meta.url.endsWith('.ts') ? 'ts' : 'mjs';
    return new URL(`./basePdfWorker.${extension}`, import.meta.url);
  }

  /**
   * Checks the PDF at the given path.
   *
   * @throws {Error} If the worker fails, runs out of memory or takes longer than the timeout.
   */
  public async check(path: string): Promise<Result<void, InvalidBasePdfError>> {
    await this.acquire();
    try {
      const { problem } = await this.runWorker(path);
      return problem
        ? Result.err(new InvalidBasePdfError({ problem }))
        : Result.ok(undefined);
    } finally {
      this.release();
    }
  }

  protected async acquire(): Promise<void> {
    if (this.running < this.maxConcurrent) {
      this.running++;
      return;
    }
    await new Promise<void>((resolve) => this.waiting.push(resolve));
  }

  protected release(): void {
    const next = this.waiting.shift();
    if (next) next();
    else this.running--;
  }

  protected runWorker(path: string): Promise<BasePdfWorkerResult> {
    const worker = new Worker(this.workerUrl, {
      workerData: { path },
      // not the parent's flags, such as a dev watcher's
      execArgv: [],
      resourceLimits: {
        maxOldGenerationSizeMb: this.maxHeapMb,
        maxYoungGenerationSizeMb: this.maxYoungMb,
      },
    });

    return new Promise<BasePdfWorkerResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        const timeout = new Error(
          `The PDF check took over ${this.timeoutMs} ms.`,
        );
        worker.removeAllListeners('exit');
        void worker.terminate().finally(() => reject(timeout));
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
}
