import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CertificateStatusEnum } from '@cert-it/shared';
import { afterEach, beforeEach, describe, expect, test } from 'vite-plus/test';
import type { Certificate } from '../../../../src/certificate/Certificate';
import { CertificateFileRoutes } from '../../../../src/certificate/file/CertificateFileRoutes';
import { StreamFileServer } from '../../../../src/certificate/file/StreamFileServer';
import type { DatabaseService } from '../../../../src/database/DatabaseService';
import { DataDirectoryService } from '../../../../src/storage/DataDirectoryService';
import { createTestDatabase } from '../../../database/mocks/createTestDatabase';
import { MockSeeder } from '../../../database/mocks/MockSeeder';
import { MockLogger } from '../../../log/mocks/MockLogger';

let parent: string;
let database: DatabaseService;
let dataDirectory: DataDirectoryService;
let certificate: Certificate;
let errors: string[];

beforeEach(async () => {
  parent = mkdtempSync(join(tmpdir(), 'cert-it-files-'));
  dataDirectory = DataDirectoryService.create({ root: parent });
  database = createTestDatabase();

  const seeder = new MockSeeder(database.getRepositories());
  const course = seeder.course();
  certificate = seeder.certificate(
    seeder.participant(course),
    seeder.templateVersion(course, seeder.user()),
  );
  await dataDirectory.writeFile(
    dataDirectory.getCertificatePath(certificate.courseId, certificate.code),
    '%PDF-1.4',
  );
  errors = [];
});

afterEach(() => {
  database.close();
  rmSync(parent, { recursive: true, force: true });
});

function request(path: string): Promise<Response> {
  const service = new CertificateFileRoutes({
    database,
    fileServer: new StreamFileServer({ dataDirectory }),
    logger: new MockLogger({ lines: errors }),
  });

  return Promise.resolve(service.getApp().request(path));
}

describe('CertificateFileRoutes (GET /c/:code/pdf)', () => {
  test('GIVEN an active certificate WHEN requesting its PDF THEN serves it inline', async () => {
    const response = await request(`/c/${certificate.code}/pdf`);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-disposition')).toMatch(/^inline;/);
    expect(await response.text()).toBe('%PDF-1.4');
  });

  test('GIVEN ?download=1 WHEN requesting the PDF THEN serves it as an attachment', async () => {
    const response = await request(`/c/${certificate.code}/pdf?download=1`);

    expect(response.headers.get('content-disposition')).toMatch(/^attachment;/);
  });

  test('GIVEN a revoked certificate WHEN requesting its PDF THEN answers 404', async () => {
    database
      .getRepositories()
      .certificates.update(certificate.id, {
        status: CertificateStatusEnum.Revoked,
        revokedAt: new Date(),
        revokedReason: 'Test',
      })
      .unwrap();

    const response = await request(`/c/${certificate.code}/pdf`);

    expect(response.status).toBe(404);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  test('GIVEN an unknown code WHEN requesting its PDF THEN answers 404', async () => {
    const response = await request('/c/NOPE-NOPE-NO/pdf');

    expect(response.status).toBe(404);
  });

  test('GIVEN an active certificate whose file is missing WHEN requesting its PDF THEN answers 404 and logs it', async () => {
    rmSync(
      dataDirectory.getCertificatePath(certificate.courseId, certificate.code),
    );

    const response = await request(`/c/${certificate.code}/pdf`);

    expect(response.status).toBe(404);
    expect(errors).toEqual([
      `The PDF of certificate ${certificate.code} is missing.`,
    ]);
  });
});
