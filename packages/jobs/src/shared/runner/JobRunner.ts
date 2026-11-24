import { type ChildProcess, fork } from 'node:child_process';
import type { Job, JobId } from '../job/Job';
import type { JobQueue } from '../job/queue/JobQueue';
import type { RunnerMessage } from '../messages/RunnerMessage';
import { RunnerMessageTypeEnum } from '../messages/RunnerMessageTypeEnum';
import type { WorkerMessage } from '../messages/WorkerMessage';
import { WorkerMessageTypeEnum } from '../messages/WorkerMessageTypeEnum';

export type JobRunnerOptions<J extends Job> = {
  queue: JobQueue<J, unknown>;
  /** Path of the worker's entry file, which starts a JobWorker. */
  workerPath: string | URL;
  /** Arguments for the worker, which it reads from `process.argv`. @default none */
  args?: readonly string[];
  /** Node flags for the worker. @default JobRunner.DefaultExecArgv */
  execArgv?: readonly string[];
  /** How often progress is saved at most. @default JobRunner.DefaultProgressIntervalMs */
  progressIntervalMs?: number;
  /** How long a job may run before the worker is killed and the job failed. @default no limit */
  timeoutMs?: number;
  /** How long a job may go without reporting progress, counted from when it's claimed, before the worker is killed and the job failed. @default no limit */
  idleTimeoutMs?: number;
  /** Where panics and crashes are logged. @default console.error */
  logError?: (line: string) => void;
  /** @default () => new Date() */
  now?: () => Date;
};

/** The job the worker is running, with its progress waiting to be saved. */
type CurrentJob<J extends Job> = {
  readonly job: J;
  pendingProgress: { progress: number; total: number | undefined } | null;
  lastProgressSavedAt: number;
  progressTimer: NodeJS.Timeout | null;
  timeoutTimer: NodeJS.Timeout | null;
  idleTimer: NodeJS.Timeout | null;
  /** Why the runner killed the worker, if it did. */
  killReason: string | null;
};

/** Runs pending jobs one at a time in a worker process that starts when there's work and exits when there's none. */
export class JobRunner<J extends Job> {
  /** Heap limits that are enough for PDF generation and leave room for the server, as measured for cert-it. */
  public static readonly DefaultExecArgv: readonly string[] = [
    '--max-old-space-size=64',
    '--max-semi-space-size=3',
  ];

  public static readonly DefaultProgressIntervalMs = 500;

  public static readonly DefaultStopGraceMs = 10_000;

  protected static readonly InterruptedError =
    'The job was interrupted by a restart.';

  // how much of the worker's stderr is kept to tell why it died
  protected static readonly MaxStderrTailChars = 4096;

  protected static readonly OutOfMemoryPattern =
    /heap out of memory|Reached heap limit/i;

  protected readonly queue: JobQueue<J, unknown>;

  protected readonly workerPath: string | URL;

  protected readonly args: readonly string[];

  protected readonly execArgv: readonly string[];

  protected readonly progressIntervalMs: number;

  protected readonly timeoutMs: number | null;

  protected readonly idleTimeoutMs: number | null;

  protected readonly logError: (line: string) => void;

  protected readonly now: () => Date;

  protected worker: ChildProcess | null = null;

  protected current: CurrentJob<J> | null = null;

  protected stderrTail = '';

  protected stopping = false;

  constructor(options: JobRunnerOptions<J>) {
    this.queue = options.queue;
    this.workerPath = options.workerPath;
    this.args = options.args ?? [];
    this.execArgv = options.execArgv ?? JobRunner.DefaultExecArgv;
    this.progressIntervalMs =
      options.progressIntervalMs ?? JobRunner.DefaultProgressIntervalMs;
    this.timeoutMs = options.timeoutMs ?? null;
    this.idleTimeoutMs = options.idleTimeoutMs ?? null;
    this.logError = options.logError ?? console.error;
    this.now = options.now ?? (() => new Date());
  }

  /** Marks jobs a restart cut off as failed, then starts any pending ones. */
  public start(): void {
    this.stopping = false;
    this.queue.failRunning(JobRunner.InterruptedError, this.now());
    this.wake();
  }

  /** Starts the worker if there are pending jobs and it isn't running. JobDispatcher calls it after adding or retrying a job. */
  public wake(): void {
    if (this.stopping || this.worker) return;

    const job = this.queue.claimNext(this.now());
    if (!job) return;

    this.current = this.createCurrent(job);
    this.startWorker();
    // also covers a worker that never gets ready
    this.resetIdleTimer(this.current);
  }

  /** Stops the worker, waiting for the current job up to the given time before killing it. A killed job stays running until the next start. */
  public async stop(options: { graceMs?: number } = {}): Promise<void> {
    const { graceMs = JobRunner.DefaultStopGraceMs } = options;
    this.stopping = true;

    const { worker } = this;
    if (!worker) return;

    const exited = new Promise<void>((resolve) =>
      worker.once('exit', () => resolve()),
    );
    if (!this.current) this.send({ type: RunnerMessageTypeEnum.Exit });

    const timer = setTimeout(() => worker.kill(), graceMs);
    await exited;
    clearTimeout(timer);
  }

  /** Returns whether a job is running. */
  public isBusy(): boolean {
    return this.current !== null;
  }

  protected startWorker(): void {
    this.stderrTail = '';
    const worker = fork(this.workerPath, [...this.args], {
      execArgv: [...this.execArgv],
      serialization: 'advanced',
      stdio: ['inherit', 'inherit', 'pipe', 'ipc'],
    });
    this.worker = worker;

    worker.stderr?.on('data', (chunk: Buffer) => {
      process.stderr.write(chunk);
      this.stderrTail = (this.stderrTail + chunk.toString()).slice(
        -JobRunner.MaxStderrTailChars,
      );
    });
    worker.on('message', (message: WorkerMessage) => this.receive(message));
    worker.on('error', (error) => this.workerGone(worker, error.message));
    worker.on('exit', (code, signal) =>
      this.workerGone(worker, this.describeExit(code, signal)),
    );
  }

  protected receive(message: WorkerMessage): void {
    const { current } = this;

    switch (message.type) {
      case WorkerMessageTypeEnum.Ready:
        if (current) this.runCurrent(current);
        return;
      case WorkerMessageTypeEnum.Progress:
        if (current?.job.id === message.jobId) {
          this.resetIdleTimer(current);
          this.queueProgress(current, message.progress, message.total);
        }
        return;
      case WorkerMessageTypeEnum.Completed:
        this.finish(message.jobId, (id, now) =>
          this.queue.complete(id, message.output, now),
        );
        return;
      case WorkerMessageTypeEnum.Failed:
        this.finish(message.jobId, (id, now) =>
          this.queue.fail(id, message.error, now),
        );
        return;
      case WorkerMessageTypeEnum.Panicked:
        this.logError(
          `Job ${message.jobId} panicked: ${message.stack ?? message.message}`,
        );
        this.finish(message.jobId, (id, now) =>
          this.queue.fail(id, message.message, now),
        );
    }
  }

  protected runCurrent(current: CurrentJob<J>): void {
    if (this.timeoutMs !== null) {
      current.timeoutTimer = setTimeout(
        () =>
          this.killFor(
            current,
            `The job took longer than ${this.timeoutMs} ms.`,
          ),
        this.timeoutMs,
      );
    }
    this.resetIdleTimer(current);

    this.send({ type: RunnerMessageTypeEnum.Run, job: current.job });
  }

  /** Saves the job's final state, then sends the worker the next job, or tells it to exit. */
  protected finish(jobId: JobId, save: (id: JobId, now: Date) => void): void {
    const { current } = this;
    if (current?.job.id !== jobId) return;

    this.saveProgress(current);
    this.clearTimers(current);
    save(jobId, this.now());
    this.current = null;

    const next = this.stopping ? null : this.queue.claimNext(this.now());
    if (!next) {
      this.send({ type: RunnerMessageTypeEnum.Exit });
      return;
    }

    this.current = this.createCurrent(next);
    this.runCurrent(this.current);
  }

  // fails the job the worker was running when it ended, then looks for more work
  protected workerGone(worker: ChildProcess, reason: string): void {
    if (this.worker !== worker) return;
    this.worker = null;

    const { current } = this;
    this.current = null;
    if (current) {
      this.clearTimers(current);
      if (!this.stopping) {
        const error = current.killReason ?? reason;
        this.logError(`Job ${current.job.id} failed: ${error}`);
        this.saveProgress(current);
        this.queue.fail(current.job.id, error, this.now());
      }
    }

    // jobs created while the worker was exiting
    this.wake();
  }

  protected queueProgress(
    current: CurrentJob<J>,
    progress: number,
    total: number | undefined,
  ): void {
    current.pendingProgress = { progress, total };
    if (current.progressTimer) return;

    const wait =
      current.lastProgressSavedAt + this.progressIntervalMs - Date.now();
    if (wait <= 0) {
      this.saveProgress(current);
      return;
    }

    current.progressTimer = setTimeout(() => {
      current.progressTimer = null;
      this.saveProgress(current);
    }, wait);
  }

  protected saveProgress(current: CurrentJob<J>): void {
    const pending = current.pendingProgress;
    if (!pending) return;

    current.pendingProgress = null;
    current.lastProgressSavedAt = Date.now();
    this.queue.setProgress(current.job.id, pending.progress, pending.total);
  }

  protected resetIdleTimer(current: CurrentJob<J>): void {
    if (this.idleTimeoutMs === null) return;
    if (current.idleTimer) clearTimeout(current.idleTimer);

    current.idleTimer = setTimeout(
      () =>
        this.killFor(
          current,
          `The job reported no progress for ${this.idleTimeoutMs} ms.`,
        ),
      this.idleTimeoutMs,
    );
  }

  // SIGKILL so a handler that traps or blocks SIGTERM still dies
  protected killFor(current: CurrentJob<J>, reason: string): void {
    if (this.current !== current) return;

    current.killReason ??= reason;
    this.worker?.kill('SIGKILL');
  }

  protected clearTimers(current: CurrentJob<J>): void {
    if (current.progressTimer) clearTimeout(current.progressTimer);
    if (current.timeoutTimer) clearTimeout(current.timeoutTimer);
    if (current.idleTimer) clearTimeout(current.idleTimer);
    current.progressTimer = null;
    current.timeoutTimer = null;
    current.idleTimer = null;
  }

  protected describeExit(
    code: number | null,
    signal: NodeJS.Signals | null,
  ): string {
    if (JobRunner.OutOfMemoryPattern.test(this.stderrTail)) {
      return 'The worker ran out of memory.';
    }

    return signal
      ? `The worker was stopped by ${signal}.`
      : `The worker exited with code ${code}.`;
  }

  protected createCurrent(job: J): CurrentJob<J> {
    return {
      job,
      pendingProgress: null,
      lastProgressSavedAt: 0,
      progressTimer: null,
      timeoutTimer: null,
      idleTimer: null,
      killReason: null,
    };
  }

  protected send(message: RunnerMessage<J>): void {
    // a worker that already exited is handled by its exit event
    this.worker?.send(message, () => {});
  }
}
