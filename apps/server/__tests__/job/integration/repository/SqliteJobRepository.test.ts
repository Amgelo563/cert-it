import type { SqliteDatabase } from '@cert-it/data';
import { afterEach, beforeEach, describe, expect, test } from 'vite-plus/test';
import type { Course } from '../../../../src/course/Course';
import type { Repositories } from '../../../../src/database/Repositories';
import { JobStatusEnum } from '../../../../src/job/JobStatusEnum';
import { JobTypeEnum } from '../../../../src/job/JobTypeEnum';
import type { User } from '../../../../src/user/User';
import { createTestDatabase } from '../../../database/mocks/createTestDatabase';
import { MockSeeder } from '../../../database/mocks/MockSeeder';

const Now = new Date('2026-11-18T12:00:00.000Z');

let database: SqliteDatabase<Repositories>;
let repositories: Repositories;
let seeder: MockSeeder;
let course: Course;
let user: User;

beforeEach(() => {
  database = createTestDatabase();
  repositories = database.getRepositories();
  seeder = new MockSeeder(repositories);
  course = seeder.course();
  user = seeder.user();
});

afterEach(() => {
  database.close();
});

function createIssueJob() {
  const participant = seeder.participant(course);
  return repositories.jobs
    .create({
      type: JobTypeEnum.Issue,
      payload: { participantIds: [participant.id], issueDate: '2026-11-18' },
      courseId: course.id,
      total: 1,
      createdBy: user.id,
    })
    .unwrap();
}

describe('SqliteJobRepository (create)', () => {
  test('GIVEN an issue job WHEN creating it THEN returns a pending job with its payload', () => {
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

describe('SqliteJobRepository (findNextPending)', () => {
  test('GIVEN running and pending jobs WHEN finding the next pending THEN returns the oldest pending one', () => {
    const running = createIssueJob();
    const first = createIssueJob();
    createIssueJob();
    repositories.jobs
      .update(running.id, { status: JobStatusEnum.Running, startedAt: Now })
      .unwrap();

    expect(repositories.jobs.findNextPending()?.id).toBe(first.id);
  });

  test('GIVEN no pending jobs WHEN finding the next pending THEN returns null', () => {
    expect(repositories.jobs.findNextPending()).toBeNull();
  });
});

describe('SqliteJobRepository (failRunning)', () => {
  test('GIVEN running and pending jobs WHEN failing running ones THEN marks only those as failed', () => {
    const running = createIssueJob();
    const pending = createIssueJob();
    repositories.jobs
      .update(running.id, { status: JobStatusEnum.Running })
      .unwrap();

    expect(repositories.jobs.failRunning('Interrupted by a restart', Now)).toBe(
      1,
    );
    expect(repositories.jobs.findById(running.id)).toMatchObject({
      status: JobStatusEnum.Failed,
      error: 'Interrupted by a restart',
      finishedAt: Now,
    });
    expect(repositories.jobs.findById(pending.id)?.status).toBe(
      JobStatusEnum.Pending,
    );
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
