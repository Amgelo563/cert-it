import type { Job } from '../job/Job';
import type { RunnerMessage } from '../messages/RunnerMessage';
import { RunnerMessageTypeEnum } from '../messages/RunnerMessageTypeEnum';
import type { WorkerMessage } from '../messages/WorkerMessage';
import { WorkerMessageTypeEnum } from '../messages/WorkerMessageTypeEnum';
import type { JobContext } from './JobContext';
import type { JobHandler } from './JobHandler';

/** A handler for every type of job, each receiving only the jobs of its type. */
export type JobHandlers<J extends Job> = {
  readonly [Type in J['type']]: JobHandler<J & { readonly type: Type }>;
};

type JobWorkerOptions<J extends Job> = {
  handlers: JobHandlers<J>;
};

/** Runs the jobs a JobRunner sends, in the worker process the runner started. */
export class JobWorker<J extends Job> {
  protected readonly handlers: JobHandlers<J>;

  constructor(options: JobWorkerOptions<J>) {
    this.handlers = options.handlers;
  }

  /**
   * Starts listening for jobs from the runner.
   *
   * @throws {Error} If this process wasn't started by a JobRunner, so there's no runner to listen to.
   */
  public start(): void {
    if (!process.send) {
      throw new Error('JobWorker must run in a process started by JobRunner.');
    }

    process.on('message', (message: RunnerMessage<J>) => {
      void this.receive(message);
    });
    this.send({ type: WorkerMessageTypeEnum.Ready });
  }

  protected async receive(message: RunnerMessage<J>): Promise<void> {
    if (message.type === RunnerMessageTypeEnum.Exit) {
      // handlers may leave connections open, which would keep the process alive
      process.exit(0);
    }

    await this.run(message.job);
  }

  protected async run(job: J): Promise<void> {
    const handler = this.handlers[job.type as J['type']] as
      | JobHandler<J>
      | undefined;
    if (!handler) {
      this.send({
        type: WorkerMessageTypeEnum.Panicked,
        jobId: job.id,
        message: `No handler for jobs of type "${job.type}".`,
        stack: null,
      });
      return;
    }

    const context: JobContext = {
      setProgress: (progress, total) =>
        this.send({
          type: WorkerMessageTypeEnum.Progress,
          jobId: job.id,
          progress,
          total,
        }),
    };

    try {
      const result = await handler.run(job, context);
      this.send(
        result.isOk()
          ? {
              type: WorkerMessageTypeEnum.Completed,
              jobId: job.id,
              output: result.value,
            }
          : {
              type: WorkerMessageTypeEnum.Failed,
              jobId: job.id,
              error: result.error.message,
            },
      );
    } catch (thrown) {
      // also catches an output that can't be sent to the runner
      const error =
        thrown instanceof Error ? thrown : new Error(String(thrown));
      this.send({
        type: WorkerMessageTypeEnum.Panicked,
        jobId: job.id,
        message: error.message,
        stack: error.stack ?? null,
      });
    }
  }

  protected send(message: WorkerMessage): void {
    process.send?.(message);
  }
}
