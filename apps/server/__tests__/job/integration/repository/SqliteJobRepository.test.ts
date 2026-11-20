import { JobStatusEnum, SqliteJobQueue } from '@cert-it/jobs';
import { afterEach, beforeEach, describe, expect, test } from 'vite-plus/test';
import type { Course } from '../../../../src/course/Course';
import type { DatabaseService } from '../../../../src/database/DatabaseService';
import type { Repositories } from '../../../../src/database/Repositories';
import type { Job } from '../../../../src/job/Job';
import { JobTypeEnum } from '../../../../src/job/JobTypeEnum';
import type { NewJob } from '../../../../src/job/NewJob';
import { jobTable } from '../../../../src/job/repository/jobTable';
import type { User } from '../../../../src/user/User';
import { createTestDatabase } from '../../../database/mocks/createTestDatabase';
import { MockSeeder } from '../../../database/mocks/MockSeeder';

const Now = new Date('2026-11-18T12:00:00.000Z');

let database: DatabaseService;
let repositories: Repositories;
let seeder: MockSeeder;
let course: Course;
let user: User;
// jobs are added through JobService in the app; its queue stands in for it here
let queue: SqliteJobQueue<Job, typeof jobTable, NewJob>;

beforeEach(() => {
  database = createTestDatabase();
  repositories = database.getRepositories();
  seeder = new MockSeeder(repositories);
  course = seeder.course();
  user = seeder.user();
  queue = new SqliteJobQueue({ db: database.getExecutor(), table: jobTable });
});

afterEach(() => {
  database.close();
});

function createIssueJob() {
  const participant = seeder.participant(course);
  return queue
    .enqueue({
      type: JobTypeEnum.Issue,
      payload: { participantIds: [participant.id], issueDate: '2026-11-18' },
      courseId: course.id,
      total: 1,
      createdBy: user.id,
    })
    .unwrap();
}

describe('SqliteJobRepository (findById)', () => {
  test('GIVEN an added issue job WHEN finding it THEN returns it pending with its payload', () => {
    const job = createIssueJob();

    expect(repositories.jobs.findById(job.id)).toMatchObject({
      type: JobTypeEnum.Issue,
      payload: { issueDate: '2026-11-18' },
      status: JobStatusEnum.Pending,
      progress: 0,
      total: 1,
      error: null,
      startedAt: null,
      finishedAt: null,
    });
  });
});

describe('jobTable (with the package queue)', () => {
  test('GIVEN pending jobs WHEN the queue claims one THEN returns the oldest with its course and creator', () => {
    const first = createIssueJob();
    createIssueJob();

    expect(queue.claimNext(Now)).toMatchObject({
      id: first.id,
      status: JobStatusEnum.Running,
      startedAt: Now,
      courseId: course.id,
      createdBy: user.id,
    });
  });
});

describe('SqliteJobRepository (listByCourse)', () => {
  test('GIVEN several jobs WHEN listing THEN returns the newest first', () => {
    const first = createIssueJob();
    const second = createIssueJob();

    const page = repositories.jobs.listByCourse(course.id, {
      page: 1,
      size: 10,
    });

    expect(page.items.map((job) => job.id)).toEqual([second.id, first.id]);
  });
});
