import { CertificateStatusEnum } from '@cert-it/shared';
import { afterEach, beforeEach, describe, expect, test } from 'vite-plus/test';
import { CertificateManager } from '../../../src/certificate/CertificateManager';
import { CertificateRegenerator } from '../../../src/certificate/job/CertificateRegenerator';
import type { DatabaseService } from '../../../src/database/DatabaseService';
import { StubFailingAuditLog } from '../../audit/mocks/StubFailingAuditLog';
import { createTestDatabase } from '../../database/mocks/createTestDatabase';
import { MockSeeder } from '../../database/mocks/MockSeeder';
import { QueueOnlyJobService } from '../../job/mocks/QueueOnlyJobService';
import { TestDataDirectories } from '../../storage/mocks/TestDataDirectories';
import { MockLogger } from '../../log/mocks/MockLogger';
import { SystemClock } from '../../../src/clock/SystemClock';

const directories = new TestDataDirectories();

let database: DatabaseService;

beforeEach(() => {
  database = createTestDatabase();
});

afterEach(() => {
  database.close();
  directories.removeAll();
});

// a manager whose audit log always fails, with one issued certificate
function setup() {
  const seeder = new MockSeeder(database.getRepositories());
  const user = seeder.user();
  const course = seeder.course();
  const participant = seeder.participant(course, { name: 'Ada' });
  const version = seeder.templateVersion(course, user);
  const certificate = seeder.certificate(participant, version);
  const auditLog = new StubFailingAuditLog(database);
  const jobs = new QueueOnlyJobService(database);
  const manager = new CertificateManager({
    database,
    auditLog,
    jobs,
    dataDirectory: directories.create(),
    regenerator: new CertificateRegenerator({ database, auditLog, jobs }),
    clock: SystemClock.Instance,
    logger: new MockLogger(),
  });
  const countJobs = () =>
    database
      .getRepositories()
      .jobs.listByCourse(course.id, { page: 1, size: 10 }).total;

  return { seeder, user, course, participant, certificate, manager, countJobs };
}

describe('CertificateManager (transactions)', () => {
  test('GIVEN an audit log that fails WHEN renaming through a certificate THEN keeps the old name and adds no job', () => {
    const { user, participant, certificate, manager, countJobs } = setup();

    expect(() =>
      manager.update({ certificate, name: 'Grace', userId: user.id }),
    ).toThrow(StubFailingAuditLog.Failure);

    expect(
      database.getRepositories().participants.findById(participant.id)?.name,
    ).toBe('Ada');
    expect(countJobs()).toBe(0);
  });

  test('GIVEN an audit log that fails WHEN issuing THEN adds no job', () => {
    const { seeder, user, course, manager, countJobs } = setup();
    seeder.participant(course);

    expect(() => manager.issue({ course, userId: user.id })).toThrow(
      StubFailingAuditLog.Failure,
    );

    expect(countJobs()).toBe(0);
  });

  test('GIVEN an audit log that fails WHEN revoking THEN the certificate stays active', () => {
    const { user, certificate, manager } = setup();

    expect(() =>
      manager.revoke({ certificate, reason: 'Mistake', userId: user.id }),
    ).toThrow(StubFailingAuditLog.Failure);

    expect(
      database.getRepositories().certificates.findById(certificate.id)?.status,
    ).toBe(CertificateStatusEnum.Active);
  });

  test('GIVEN an audit log that fails WHEN deleting THEN keeps the certificate', async () => {
    const { user, certificate, manager } = setup();

    await expect(manager.remove(certificate, user.id)).rejects.toThrow(
      StubFailingAuditLog.Failure,
    );

    expect(
      database.getRepositories().certificates.findById(certificate.id),
    ).not.toBeNull();
  });
});
