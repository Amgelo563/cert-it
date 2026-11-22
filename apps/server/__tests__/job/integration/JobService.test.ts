import { SqliteJobQueue } from '@cert-it/jobs';
import {
  type ApiPage,
  AuditActionEnum,
  AuditEntityEnum,
  type JobSummary,
  JobTypeEnum,
  RoleEnum,
} from '@cert-it/shared';
import { afterEach, describe, expect, test } from 'vite-plus/test';
import type { Course } from '../../../src/course/Course';
import type { DatabaseService } from '../../../src/database/DatabaseService';
import type { Job } from '../../../src/job/Job';
import type { NewJob } from '../../../src/job/NewJob';
import { jobTable } from '../../../src/job/repository/jobTable';
import type { ParticipantId } from '../../../src/participant/Participant';
import type { UserId } from '../../../src/user/User';
import { createTestDatabase } from '../../database/mocks/createTestDatabase';
import { MockSeeder } from '../../database/mocks/MockSeeder';
import { createApiHarness } from '../../http/mocks/createApiHarness';

const databases: DatabaseService[] = [];

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
});

// an Editor logged in through the API, and a queue to put jobs in any state
async function setup() {
  const database = createTestDatabase();
  databases.push(database);
  const harness = createApiHarness(database);
  const editor = await harness.loginAs({
    email: 'editor@example.org',
    role: RoleEnum.Editor,
  });
  const seeder = new MockSeeder(database.getRepositories());
  const course = seeder.course();
  const queue = new SqliteJobQueue<Job, typeof jobTable, NewJob>({
    db: database.getExecutor(),
    table: jobTable,
    toModel: (row) => row as Job,
  });
  const addJob = (target: Course = course) =>
    queue
      .enqueue({
        type: JobTypeEnum.Issue,
        payload: {
          participantIds: [1 as ParticipantId],
          issueDate: '2026-11-20',
        },
        courseId: target.id,
        total: 1,
        createdBy: editor.user.id as UserId,
      })
      .unwrap();
  const failJob = (job: Job) => {
    queue.claimNext(new Date());
    queue.fail(job.id, 'The worker ran out of memory', new Date());
  };
  const jobs = (method: string, path: string, courseId: number = course.id) =>
    harness.request(method, `/courses/${courseId}/jobs${path}`, {
      cookie: editor.cookie,
    });

  return { course, database, editor, addJob, failJob, jobs, seeder };
}

describe('JobService (read)', () => {
  test('GIVEN jobs in two courses WHEN listing one THEN answers its own, newest first', async () => {
    const { addJob, course, jobs, seeder } = await setup();
    const first = addJob();
    const second = addJob();
    addJob(seeder.course());

    const response = await jobs('GET', '');
    const page = (await response.json()) as ApiPage<JobSummary>;

    expect(response.status).toBe(200);
    expect(page.total).toBe(2);
    expect(page.items.map((job) => job.id)).toEqual([second.id, first.id]);
    expect(page.items[0]).toEqual({
      id: second.id,
      courseId: course.id,
      type: JobTypeEnum.Issue,
      status: 'pending',
      progress: 0,
      total: 1,
      output: null,
      error: null,
      createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      startedAt: null,
      finishedAt: null,
    });
  });

  test('GIVEN a failed job WHEN getting it THEN answers its error and end time', async () => {
    const { addJob, failJob, jobs } = await setup();
    const job = addJob();
    failJob(job);

    const response = await jobs('GET', `/${job.id}`);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      status: 'failed',
      error: 'The worker ran out of memory',
      finishedAt: expect.stringMatching(/^\d{4}-/),
    });
  });

  test('GIVEN a job of another course WHEN getting it through this one THEN answers 404', async () => {
    const { addJob, jobs, seeder } = await setup();
    const job = addJob(seeder.course());

    const response = await jobs('GET', `/${job.id}`);

    expect(response.status).toBe(404);
  });
});

describe('JobService (retry)', () => {
  test('GIVEN a failed job WHEN retrying it THEN puts it back as pending and audits it as a retried issue', async () => {
    const { addJob, course, database, editor, failJob, jobs } = await setup();
    const job = addJob();
    failJob(job);

    const response = await jobs('POST', `/${job.id}/retry`);

    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({
      id: job.id,
      status: 'pending',
      error: null,
    });
    expect(
      database
        .getRepositories()
        .auditLog.list({ page: 1, size: 10 })
        .items.filter((entry) => entry.entity === AuditEntityEnum.Job),
    ).toEqual([
      expect.objectContaining({
        action: AuditActionEnum.Issue,
        entityId: job.id,
        userId: editor.user.id,
        details: { courseId: course.id, retry: true },
      }),
    ]);
  });

  test('GIVEN a pending job WHEN retrying it THEN answers 409 job_not_failed', async () => {
    const { addJob, jobs } = await setup();
    const job = addJob();

    const response = await jobs('POST', `/${job.id}/retry`);

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'job_not_failed' });
  });
});
