import type { DatabaseService } from '../../../../src/database/DatabaseService';
import { afterEach, beforeEach, describe, expect, test } from 'vite-plus/test';
import type { Repositories } from '../../../../src/database/Repositories';
import { createTestDatabase } from '../../../database/mocks/createTestDatabase';
import { MockSeeder } from '../../../database/mocks/MockSeeder';
import { normalizeEmail } from '../../../../src/util/email/NormalizedEmail';

let database: DatabaseService;
let repositories: Repositories;
let seeder: MockSeeder;

beforeEach(() => {
  database = createTestDatabase();
  repositories = database.getRepositories();
  seeder = new MockSeeder(repositories);
});

afterEach(() => {
  database.close();
});

describe('SqliteParticipantRepository (create)', () => {
  test('GIVEN no extra columns WHEN creating THEN stores an empty object', () => {
    const participant = seeder.participant(seeder.course());

    expect(participant.extra).toEqual({});
  });

  test('GIVEN extra columns WHEN creating THEN returns them as an object', () => {
    const course = seeder.course();

    const participant = repositories.participants
      .create({
        courseId: course.id,
        name: 'Ada',
        email: normalizeEmail('ada@example.org'),
        extra: { city: 'London' },
      })
      .unwrap();

    expect(repositories.participants.findById(participant.id)?.extra).toEqual({
      city: 'London',
    });
  });

  test('GIVEN a participant WHEN creating another with the same email in the same course THEN returns a DuplicateModelError on courseId and email', () => {
    const course = seeder.course();
    seeder.participant(course, { email: 'ada@example.org' });

    const result = repositories.participants.create({
      courseId: course.id,
      name: 'Ada again',
      email: normalizeEmail('ada@example.org'),
    });

    expect(result.isErr() && result.error.isOn('courseId', 'email')).toBe(true);
  });

  test('GIVEN a participant WHEN creating one with the same email in another course THEN creates it', () => {
    seeder.participant(seeder.course(), { email: 'ada@example.org' });

    const other = seeder.course();
    const result = repositories.participants.create({
      courseId: other.id,
      name: 'Ada',
      email: normalizeEmail('ada@example.org'),
    });

    expect(result.isOk()).toBe(true);
  });
});

describe('SqliteParticipantRepository (findByEmail)', () => {
  test('GIVEN participants in two courses WHEN finding by email in one THEN returns the one of that course', () => {
    const course = seeder.course();
    const participant = seeder.participant(course, {
      email: 'ada@example.org',
    });
    seeder.participant(seeder.course(), { email: 'ada@example.org' });

    expect(
      repositories.participants.findByEmail(
        course.id,
        normalizeEmail('ada@example.org'),
      ),
    ).toEqual(participant);
  });
});

describe('SqliteParticipantRepository (findByIds)', () => {
  test('GIVEN some existing IDs WHEN finding them THEN skips the missing ones', () => {
    const course = seeder.course();
    const first = seeder.participant(course);
    const second = seeder.participant(course);
    const missing = (second.id + 100) as typeof second.id;

    expect(
      repositories.participants.findByIds([second.id, missing, first.id]),
    ).toEqual([first, second]);
  });

  test('GIVEN no IDs WHEN finding them THEN returns an empty list', () => {
    seeder.participant(seeder.course());

    expect(repositories.participants.findByIds([])).toEqual([]);
  });
});

describe('SqliteParticipantRepository (listByCourse)', () => {
  test('GIVEN participants in two courses WHEN listing one THEN returns its participants by name', () => {
    const course = seeder.course();
    seeder.participant(course, { name: 'Bob' });
    seeder.participant(course, { name: 'Ada' });
    seeder.participant(seeder.course(), { name: 'Other' });

    const page = repositories.participants.listByCourse(course.id, {
      page: 1,
      size: 10,
    });

    expect(page.items.map((participant) => participant.name)).toEqual([
      'Ada',
      'Bob',
    ]);
    expect(page.total).toBe(2);
  });
});

describe('SqliteParticipantRepository (listWithoutCertificate)', () => {
  test('GIVEN participants with and without certificates WHEN listing those without THEN skips the ones with one', () => {
    const user = seeder.user();
    const course = seeder.course();
    const templateVersion = seeder.templateVersion(course, user);
    const issued = seeder.participant(course, { name: 'Ada' });
    const pending = seeder.participant(course, { name: 'Bob' });
    seeder.participant(seeder.course(), { name: 'Other course' });
    seeder.certificate(issued, templateVersion);

    expect(repositories.participants.listWithoutCertificate(course.id)).toEqual(
      [pending],
    );
  });
});

describe('SqliteParticipantRepository (countByCourses)', () => {
  test('GIVEN courses with and without participants WHEN counting THEN leaves out empty and unrequested courses', () => {
    const first = seeder.course();
    const second = seeder.course();
    const empty = seeder.course();
    const unrequested = seeder.course();
    seeder.participant(first);
    seeder.participant(first);
    seeder.participant(second);
    seeder.participant(unrequested);

    const counts = repositories.participants.countByCourses([
      first.id,
      second.id,
      empty.id,
    ]);

    expect(counts).toEqual(
      new Map([
        [first.id, 2],
        [second.id, 1],
      ]),
    );
  });
});

describe('SqliteParticipantRepository (delete)', () => {
  test('GIVEN a participant with a certificate WHEN deleting it THEN deletes the certificate too', () => {
    const course = seeder.course();
    const participant = seeder.participant(course);
    const certificate = seeder.certificate(
      participant,
      seeder.templateVersion(course, seeder.user()),
    );

    expect(repositories.participants.delete(participant.id).isOk()).toBe(true);
    expect(repositories.certificates.findById(certificate.id)).toBeNull();
  });
});
