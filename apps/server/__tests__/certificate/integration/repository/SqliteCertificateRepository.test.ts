import type { DatabaseService } from '../../../../src/database/DatabaseService';
import { CertificateStatusEnum } from '@cert-it/shared';
import { afterEach, beforeEach, describe, expect, test } from 'vite-plus/test';
import type { Course } from '../../../../src/course/Course';
import type { Repositories } from '../../../../src/database/Repositories';
import type { TemplateVersion } from '../../../../src/template/TemplateVersion';
import { createTestDatabase } from '../../../database/mocks/createTestDatabase';
import { MockSeeder } from '../../../database/mocks/MockSeeder';
import { normalizeEmail } from '../../../../src/util/email/NormalizedEmail';
import { SqliteCertificateRepository } from '../../../../src/certificate/repository/SqliteCertificateRepository';

let database: DatabaseService;
let repositories: Repositories;
let seeder: MockSeeder;
let course: Course;
let templateVersion: TemplateVersion;

beforeEach(() => {
  database = createTestDatabase();
  repositories = database.getRepositories();
  seeder = new MockSeeder(repositories);
  course = seeder.course();
  templateVersion = seeder.templateVersion(course, seeder.user());
});

afterEach(() => {
  database.close();
});

function issue(email?: string, inCourse = course) {
  const version =
    inCourse === course
      ? templateVersion
      : seeder.templateVersion(inCourse, seeder.user());

  return seeder.certificate(seeder.participant(inCourse, { email }), version);
}

function toNewCertificate(certificate: ReturnType<typeof issue>) {
  const { code, courseId, participantId, templateVersionId, issueDate } =
    certificate;
  return { code, courseId, participantId, templateVersionId, issueDate };
}

function revoke(certificate: ReturnType<typeof issue>) {
  return repositories.certificates
    .update(certificate.id, {
      status: CertificateStatusEnum.Revoked,
      revokedAt: new Date(),
      revokedReason: 'Mistake',
    })
    .unwrap();
}

describe('SqliteCertificateRepository (create)', () => {
  test('GIVEN valid values WHEN creating THEN returns an active certificate', () => {
    const certificate = issue();

    expect(certificate).toMatchObject({
      status: CertificateStatusEnum.Active,
      revokedAt: null,
      revokedReason: null,
    });
  });

  test('GIVEN a participant with a certificate WHEN creating another THEN returns a DuplicateModelError on participantId', () => {
    const certificate = issue();

    const result = repositories.certificates.create({
      ...toNewCertificate(certificate),
      code: 'OTHE-RCOD-EX' as typeof certificate.code,
    });

    expect(result.isErr() && result.error.isOn('participantId')).toBe(true);
  });

  test('GIVEN a certificate WHEN creating another with its code THEN returns a DuplicateModelError on code', () => {
    const certificate = issue();

    const result = repositories.certificates.create({
      ...toNewCertificate(certificate),
      participantId: seeder.participant(course).id,
    });

    expect(result.isErr() && result.error.isOn('code')).toBe(true);
  });
});

describe('SqliteCertificateRepository (findByCode)', () => {
  test('GIVEN a certificate WHEN finding by its code THEN returns it', () => {
    const certificate = issue();

    expect(repositories.certificates.findByCode(certificate.code)).toEqual(
      certificate,
    );
  });
});

describe('SqliteCertificateRepository (findByParticipant)', () => {
  test('GIVEN a certificate WHEN finding by its participant THEN returns it', () => {
    const certificate = issue();

    expect(
      repositories.certificates.findByParticipant(certificate.participantId),
    ).toEqual(certificate);
  });
});

describe('SqliteCertificateRepository (findActiveByEmail)', () => {
  test('GIVEN an active certificate WHEN finding by the participant email THEN returns it', () => {
    const certificate = issue('ada@example.org');

    expect(
      repositories.certificates.findActiveByEmail(
        course.id,
        normalizeEmail(' ADA@example.org'),
      ),
    ).toEqual(certificate);
  });

  test('GIVEN a revoked certificate WHEN finding by the participant email THEN returns null', () => {
    revoke(issue('ada@example.org'));

    expect(
      repositories.certificates.findActiveByEmail(
        course.id,
        normalizeEmail('ada@example.org'),
      ),
    ).toBeNull();
  });

  test('GIVEN a certificate in another course WHEN finding by email in this course THEN returns null', () => {
    issue('ada@example.org', seeder.course());

    expect(
      repositories.certificates.findActiveByEmail(
        course.id,
        normalizeEmail('ada@example.org'),
      ),
    ).toBeNull();
  });
});

describe('SqliteCertificateRepository (update)', () => {
  test('GIVEN a certificate WHEN revoking and reinstating it THEN clears the revocation', () => {
    const revoked = revoke(issue());

    const reinstated = repositories.certificates
      .update(revoked.id, {
        status: CertificateStatusEnum.Active,
        revokedAt: null,
        revokedReason: null,
      })
      .unwrap();

    expect(revoked.revokedReason).toBe('Mistake');
    expect(reinstated).toMatchObject({
      status: CertificateStatusEnum.Active,
      revokedAt: null,
      revokedReason: null,
    });
  });
});

describe('SqliteCertificateRepository (listByCourse)', () => {
  test('GIVEN certificates in two courses WHEN listing one THEN returns its certificates newest first', () => {
    const first = issue();
    const second = issue();
    issue(undefined, seeder.course());

    const page = repositories.certificates.listByCourse(course.id, {
      page: 1,
      size: 10,
    });

    expect(page.items).toEqual([second, first]);
    expect(page.total).toBe(2);
  });
});

describe('SqliteCertificateRepository (listWithOtherVersion)', () => {
  test('GIVEN certificates on old and latest versions WHEN listing those with another version THEN returns the old ones', () => {
    const old = issue();
    const latest = seeder.templateVersion(course, seeder.user());
    seeder.certificate(seeder.participant(course), latest);

    expect(
      repositories.certificates.listWithOtherVersion(course.id, latest.id),
    ).toEqual([old]);
  });
});

describe('SqliteCertificateRepository (countByCourses)', () => {
  test('GIVEN active and revoked certificates WHEN counting THEN counts each status, with zero for missing ones', () => {
    issue();
    revoke(issue());
    issue();
    const other = seeder.course();
    issue(undefined, other);

    const counts = repositories.certificates.countByCourses([
      course.id,
      other.id,
    ]);

    expect(counts).toEqual(
      new Map([
        [course.id, { active: 2, revoked: 1 }],
        [other.id, { active: 1, revoked: 0 }],
      ]),
    );
  });
});

describe('SqliteCertificateRepository (status indexes)', () => {
  test('GIVEN new certificates WHEN creating THEN each gets a distinct index inside the list', () => {
    const indexes = Array.from({ length: 20 }, () => issue().statusIndex);
    const length = repositories.certificates.findStatusListLength();

    expect(new Set(indexes).size).toBe(indexes.length);
    for (const index of indexes) {
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(length);
    }
  });

  test('GIVEN revoked and deleted certificates WHEN listing revoked indexes THEN returns both, but not active ones', () => {
    const active = issue();
    const revoked = revoke(issue());
    const deleted = issue();
    repositories.certificates.delete(deleted.id).unwrap();

    const indexes = repositories.certificates.listRevokedStatusIndexes();

    expect(indexes.toSorted((a, b) => a - b)).toEqual(
      [revoked.statusIndex, deleted.statusIndex].toSorted((a, b) => a - b),
    );
    expect(indexes).not.toContain(active.statusIndex);
  });

  test('GIVEN a certificate WHEN its course is deleted THEN its index stays retired', () => {
    const certificate = issue();

    repositories.courses.delete(course.id).unwrap();

    expect(repositories.certificates.listRevokedStatusIndexes()).toEqual([
      certificate.statusIndex,
    ]);
  });

  test('GIVEN no certificates WHEN reading the list length THEN is the minimum', () => {
    expect(repositories.certificates.findStatusListLength()).toBe(
      SqliteCertificateRepository.MinStatusListLength,
    );
  });
});
