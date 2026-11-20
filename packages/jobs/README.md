# @cert-it/jobs

Runs slow work, like generating hundreds of PDFs, in a separate Node process, one job at a time. Each job is a row in a
SQLite table, so the app can show its progress and what happened to it.

- `shared/service/`: `JobService`, what the app uses to add jobs, retry them, and start or stop the whole thing.
- `shared/job/`: the `Job` type.
- `shared/worker/`: `JobWorker` and `JobHandler`, which do the work in the separate process.
- `shared/runner/`: `JobRunner`, which starts and stops that process. `JobService` uses it for you.
- `sqlite/`: the columns your jobs table needs, and `SqliteJobService`.

`drizzle-orm` and `better-sqlite3` are peer dependencies, so the app picks their versions.

## Usage

### 1. Job type and table

Each job has a type, which says what to do, and a payload, which is the input for it. List your types with the payload
each one takes, then build your job type with `JobOf` and add any fields of your own:

```ts
// job/ReportJobTypeEnum.ts
export const ReportJobTypeEnum = {
  Monthly: 'monthly',
  Yearly: 'yearly',
} as const;

// job/ReportTask.ts
export type ReportTask =
  | {
      readonly type: typeof ReportJobTypeEnum.Monthly;
      readonly payload: { year: number; month: number };
    }
  | {
      readonly type: typeof ReportJobTypeEnum.Yearly;
      readonly payload: { year: number };
    };

// job/ReportJob.ts
import type { JobOf } from '@cert-it/jobs';

export type ReportJob = JobOf<ReportTask> & {
  readonly requestedBy: UserId;
};

// job/NewReportJob.ts: what jobs.add takes
export type NewReportJob = ReportTask & { requestedBy: UserId };
```

The payload is stored as JSON, and only the code that does the job reads it. Your own fields, like `requestedBy`, get
their own columns, so you can search by them and link them to other tables. If you'll ever look jobs up by something,
make it a field; if only the job's code needs it, put it in the payload.

For the table, add the package's columns and indexes next to yours. drizzle-kit creates its migrations like for any
other table:

```ts
// job/repository/reportJobTable.ts
import { sqliteJobColumns, sqliteJobIndexes } from '@cert-it/jobs';

export const reportJobTable = sqliteTable(
  'report_jobs',
  {
    ...sqliteJobColumns<ReportTask['type'], ReportTask['payload']>(),
    requestedBy: integer('requested_by')
      .notNull()
      .references(() => userTable.id)
      .$type<UserId>(),
  },
  (table) => [...sqliteJobIndexes(table, 'report_jobs')],
);
```

### 2. Service

Create one `SqliteJobService` when the app starts, and use it for everything. Adding a job saves it and starts it, so
there's nothing else to call:

```ts
import { SqliteJobService } from '@cert-it/jobs';

const jobs = new SqliteJobService<
  ReportJob,
  typeof reportJobTable,
  NewReportJob
>({
  db: database.getExecutor(),
  table: reportJobTable,
  workerPath: new URL('./worker.mjs', import.meta.url),
});
jobs.start(); // fails jobs a restart cut off, then runs pending ones

app.post('/reports', (c) => {
  const job = jobs
    .add({
      type: ReportJobTypeEnum.Monthly,
      payload: { year: 2026, month: 11 },
      requestedBy,
    })
    .unwrap();
  return c.json({ id: job.id }, 202);
});

app.post('/reports/:id/retry', (c) => {
  const result = jobs.retry(Number(c.req.param('id')) as JobId);
  // ...
});

process.on('SIGTERM', async () => {
  await jobs.stop({ graceMs: 10_000 }); // lets the current job finish, up to 10 s
  process.exit(0);
});
```

You can also add a job inside a transaction, as long as it uses the same database connection you gave the service. The
job is then saved only if the rest of the transaction is, and it starts once the transaction is done:

```ts
unitOfWork.transaction((repositories) =>
  repositories.reports.markRequested(month).andThen(() =>
    jobs.add({
      type: ReportJobTypeEnum.Monthly,
      payload: { year: 2026, month: 11 },
      requestedBy,
    }),
  ),
);
```

The separate process only runs while there are jobs. It starts when one is added, works through them one by one, and
exits when they're all done, which frees the memory it used.

It gets a memory limit of 64 MB, so a heavy job can't use up the server's memory. To change it, pass Node flags in
`execArgv` (the default is `--max-old-space-size=64 --max-semi-space-size=3`). The other options are:

- `timeoutMs`: how long a job may run before it's stopped and marked as failed. No limit by default.
- `progressIntervalMs`: how often progress is saved at most. 500 ms by default.
- `logError`: where crashes are logged. `console.error` by default.

Jobs can't be cancelled, scheduled for later, or run in parallel.

### 3. Reading jobs

To list jobs or show one, write a repository for the same table, with only reading methods:

```ts
// job/repository/ReportJobRepository.ts
/** An object that queries report jobs. Jobs are added and change state only through the job service. */
export interface ReportJobRepository {
  findById(id: JobId): ReportJob | null;
  listByUser(userId: UserId, page: PageRequest): Page<ReportJob>;
}

// job/repository/SqliteReportJobRepository.ts
export class SqliteReportJobRepository
  extends AbstractSqliteRepository<ReportJob, typeof reportJobTable>
  implements ReportJobRepository
{
  protected readonly table = reportJobTable;

  public listByUser(userId: UserId, page: PageRequest): Page<ReportJob> {
    return this.findPage(page, {
      where: eq(reportJobTable.requestedBy, userId),
      orderBy: [desc(reportJobTable.id)],
    });
  }

  // the type column decides the payload's shape, which only the job service writes
  protected toModel(row: typeof reportJobTable.$inferSelect): ReportJob {
    return row as ReportJob;
  }
}
```

**Don't give it methods that write.** That way a job's status only changes through the service, which follows the job's
state machine rules.

### 4. Handlers

A handler is the code that does one type of job. It runs in the separate process, and returns `Ok` with a result to save
with the job, or `Err` with the reason it couldn't do it:

```ts
// job/handlers/MonthlyReportHandler.ts
import type { JobContext, JobHandler } from '@cert-it/jobs';

type MonthlyReportJob = Extract<
  ReportJob,
  { type: typeof ReportJobTypeEnum.Monthly }
>;

export class MonthlyReportHandler implements JobHandler<
  MonthlyReportJob,
  { rows: number },
  NoDataError
> {
  // job.payload is { year, month }
  public async run(job: MonthlyReportJob, context: JobContext) {
    const rows = await loadRows(job.payload.year, job.payload.month);
    if (rows.length === 0) return Result.err(new NoDataError());

    for (const [i, row] of rows.entries()) {
      await writeRow(row);
      context.setProgress(i + 1, rows.length);
    }

    return Result.ok({ rows: rows.length });
  }
}
```

Call `setProgress` as often as you like, even for every item. It's saved at most every 500 ms.

A retried job starts over from the beginning, so a handler should skip work that an earlier attempt already finished.

### 5. Worker

The separate process needs its own entry file. It creates a `JobWorker` with a handler for each job type, and
forgetting one is a compile error:

```ts
// worker.ts
import { JobWorker } from '@cert-it/jobs';

new JobWorker<ReportJob>({
  handlers: {
    [ReportJobTypeEnum.Monthly]: new MonthlyReportHandler(),
    [ReportJobTypeEnum.Yearly]: new YearlyReportHandler(),
  },
}).start();
```

The worker doesn't save anything to the jobs table itself. It sends progress and results back to the main process,
which saves them. A handler that needs to read from the database opens its own connection.

Build `worker.ts` as its own file, next to the server's.

### 6. Handling errors

A failed job has status `failed`, and the reason in `error`.

If the handler returns `Err`, the reason is the error's `message`. That's an expected failure, so nothing is logged.

If something goes wrong that the handler didn't plan for, the job fails as well, and the error is also logged so you can
find the bug. That's when a handler throws, the separate process crashes or runs out of memory, or a job runs longer
than `timeoutMs`. After a crash, the next job starts in a fresh process.

A job that was running when the app restarted, or that `stop()` had to cut short, is marked as failed the next time you
call `start()`.

`jobs.retry(id)` runs a failed job again. It returns a `JobNotFailedError` if the job hasn't failed, and a
`ModelNotFoundError` if there's no job with that ID.
