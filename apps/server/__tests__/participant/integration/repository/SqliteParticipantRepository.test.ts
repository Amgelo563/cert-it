import {
  CertificateStatusEnum,
  ParticipantCertificateFilterEnum,
} from '@cert-it/shared';
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
  test('GIVEN no field values WHEN creating THEN stores an empty object', () => {
    const participant = seeder.participant(seeder.course());

    expect(participant.fieldValues).toEqual({});
  });

  test('GIVEN field values WHEN creating THEN returns them as an object', () => {
    const course = seeder.course();

    const participant = repositories.participants
      .create({
        courseId: course.id,
        name: 'Ada',
        email: normalizeEmail('ada@example.org'),
        fieldValues: { '1': 'London', '2': 18.5, '3': true },
      })
      .unwrap();

    expect(
      repositories.participants.findById(participant.id)?.fieldValues,
    ).toEqual({ '1': 'London', '2': 18.5, '3': true });
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

describe('SqliteParticipantRepository (listByCourse search)', () => {
  test('GIVEN a search WHEN listing THEN matches name or email, ignoring case', () => {
    const course = seeder.course();
    seeder.participant(course, {
      name: 'Ada Lovelace',
      email: 'ada@example.org',
    });
    seeder.participant(course, { name: 'Bob', email: 'bob@lovelace.org' });
    seeder.participant(course, { name: 'Carol', email: 'carol@example.org' });

    const page = repositories.participants.listByCourse(
      course.id,
      { page: 1, size: 10 },
      ' LOVELACE ',
    );

    expect(page.items.map((participant) => participant.name)).toEqual([
      'Ada Lovelace',
      'Bob',
    ]);
    expect(page.total).toBe(2);
  });

  test.each([
    { filter: ParticipantCertificateFilterEnum.None, names: ['Cy'] },
    { filter: ParticipantCertificateFilterEnum.Active, names: ['Ada'] },
    { filter: ParticipantCertificateFilterEnum.Revoked, names: ['Bob'] },
  ])(
    'GIVEN participants in each certificate state WHEN listing  THEN answers only those',
    ({ filter, names }) => {
      const course = seeder.course();
      const admin = seeder.user();
      const version = seeder.templateVersion(course, admin);
      seeder.certificate(seeder.participant(course, { name: 'Ada' }), version);
      const revoked = seeder.certificate(
        seeder.participant(course, { name: 'Bob' }),
        version,
      );
      repositories.certificates
        .update(revoked.id, {
          status: CertificateStatusEnum.Revoked,
          revokedAt: new Date(),
          revokedReason: 'Duplicate',
        })
        .unwrap();
      seeder.participant(course, { name: 'Cy' });
      seeder.participant(seeder.course(), { name: 'Other' });

      const page = repositories.participants.listByCourse(
        course.id,
        { page: 1, size: 10 },
        undefined,
        filter,
      );

      expect(page.items.map((participant) => participant.name)).toEqual(names);
      expect(page.total).toBe(names.length);
    },
  );

  test('GIVEN a search with % WHEN listing THEN matches it literally', () => {
    const course = seeder.course();
    seeder.participant(course, { name: 'Ada' });
    seeder.participant(course, { name: '100% Bob' });

    const page = repositories.participants.listByCourse(
      course.id,
      { page: 1, size: 10 },
      '%',
    );

    expect(page.items.map((participant) => participant.name)).toEqual([
      '100% Bob',
    ]);
  });
});

describe('SqliteParticipantRepository (listByEmails)', () => {
  test('GIVEN more emails than one chunk WHEN listing THEN finds only matches in the course', () => {
    const course = seeder.course();
    const ada = seeder.participant(course, { email: 'ada@example.org' });
    seeder.participant(course, { email: 'bob@example.org' });
    seeder.participant(seeder.course(), { email: 'carol@example.org' });
    const emails = [
      ...Array.from({ length: 600 }, (_, i) => `nobody${i}@example.org`),
      'ada@example.org',
      'carol@example.org',
    ].map(normalizeEmail);

    expect(repositories.participants.listByEmails(course.id, emails)).toEqual([
      ada,
    ]);
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

describe('SqliteParticipantRepository (field values)', () => {
  test('GIVEN values of two fields WHEN counting THEN answers per field, leaving out other courses', () => {
    const course = seeder.course();
    seeder.participant(course, { fieldValues: { '1': 'A', '2': 3 } });
    seeder.participant(course, { fieldValues: { '1': 'B' } });
    seeder.participant(seeder.course(), { fieldValues: { '1': 'C' } });

    expect(repositories.participants.countFieldValues(course.id)).toEqual(
      new Map([
        ['1', 2],
        ['2', 1],
      ]),
    );
  });

  test('GIVEN a field with values WHEN removing it THEN clears only that course and field', () => {
    const course = seeder.course();
    const ada = seeder.participant(course, {
      fieldValues: { '1': 'A', '2': 3 },
    });
    const other = seeder.participant(seeder.course(), {
      fieldValues: { '1': 'C' },
    });

    expect(repositories.participants.removeFieldValue(course.id, 1)).toBe(1);
    expect(repositories.participants.findById(ada.id)?.fieldValues).toEqual({
      '2': 3,
    });
    expect(repositories.participants.findById(other.id)?.fieldValues).toEqual({
      '1': 'C',
    });
  });

  test('GIVEN values WHEN listing those of some fields THEN answers each with its course', () => {
    const course = seeder.course();
    seeder.participant(course, { fieldValues: { '1': 'a.png', '2': 'x' } });

    expect(repositories.participants.listFieldValues([1])).toEqual([
      { courseId: course.id, value: 'a.png' },
    ]);
  });
});
