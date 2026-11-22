import { CertificateStatusEnum, RoleEnum } from '@cert-it/shared';
import { afterEach, describe, expect, test } from 'vite-plus/test';
import type { Certificate } from '../../../../src/certificate/Certificate';
import type { DatabaseService } from '../../../../src/database/DatabaseService';
import { createTestDatabase } from '../../../database/mocks/createTestDatabase';
import { MockSeeder } from '../../../database/mocks/MockSeeder';
import { createApiHarness } from '../../../http/mocks/createApiHarness';
import { TestDataDirectories } from '../../../storage/mocks/TestDataDirectories';

const databases: DatabaseService[] = [];

const directories = new TestDataDirectories();

afterEach(() => {
  for (const database of databases.splice(0)) database.close();
  directories.removeAll();
});

// an Editor with a course of three participants: active, revoked and without a PDF on disk
async function setup() {
  const database = createTestDatabase();
  databases.push(database);
  const dataDirectory = directories.create();
  const harness = createApiHarness(database, { dataDirectory });
  const editor = await harness.loginAs({
    email: 'editor@example.org',
    role: RoleEnum.Editor,
  });
  const seeder = new MockSeeder(database.getRepositories());
  const course = seeder.course({ name: 'Redes 2026' });
  const version = seeder.templateVersion(course, editor.user);
  const certificate = (name: string, email: string): Certificate =>
    seeder.certificate(seeder.participant(course, { name, email }), version);

  const ada = certificate('Ada / Lovelace', 'ada@example.org');
  directories.writePdf(dataDirectory, ada);
  const bob = certificate('Bob', 'bob@example.org');
  directories.writePdf(dataDirectory, bob);
  const revoked = database
    .getRepositories()
    .certificates.update(bob.id, {
      status: CertificateStatusEnum.Revoked,
      revokedAt: new Date(),
      revokedReason: 'Duplicate, sent twice',
    })
    .unwrap();
  const missing = certificate('=Cy', 'cy@example.org');
  seeder.participant(course, { name: 'No certificate' });

  const download = (format: string, cookie = editor.cookie) =>
    harness.request(
      'GET',
      `/courses/${course.id}/certificates/export/${format}`,
      { cookie },
    );

  return { ...harness, ada, course, download, missing, revoked };
}

describe('CertificateExportService (zip)', () => {
  test('GIVEN active, revoked and missing PDFs WHEN downloading the ZIP THEN streams only the active ones that exist, named after the participant', async () => {
    const { ada, download, missing, revoked } = await setup();

    const response = await download('zip');
    const bytes = Buffer.from(await response.arrayBuffer());
    const text = bytes.toString('latin1');

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/zip');
    expect(response.headers.get('content-disposition')).toBe(
      `attachment; filename="Redes 2026 - certificates.zip"; filename*=UTF-8''Redes%202026%20-%20certificates.zip`,
    );
    expect(bytes.subarray(0, 4).toString('latin1')).toBe('PK\u0003\u0004');
    expect(text).toContain(`Ada Lovelace - ${ada.code}.pdf`);
    expect(text).toContain('%PDF-1.7');
    expect(text).not.toContain(revoked.code);
    expect(text).not.toContain(missing.code);
  });

  test('GIVEN a Viewer WHEN downloading the ZIP THEN answers 403', async () => {
    const { download, loginAs } = await setup();
    const viewer = await loginAs({
      email: 'viewer@example.org',
      role: RoleEnum.Viewer,
    });

    expect((await download('zip', viewer.cookie)).status).toBe(403);
  });
});

describe('CertificateExportService (csv)', () => {
  test('GIVEN certificates in each state WHEN exporting the CSV THEN lists every one by name with its public URL', async () => {
    const { ada, download, missing, revoked } = await setup();

    const response = await download('csv');
    // text() would drop the byte order mark, so the bytes are read instead
    const bytes = Buffer.from(await response.arrayBuffer());
    const lines = bytes.subarray(3).toString('utf8').split('\r\n');

    expect(response.status).toBe(200);
    expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(response.headers.get('content-type')).toBe(
      'text/csv; charset=utf-8',
    );
    expect(lines).toEqual([
      'name,email,code,status,issue_date,template_version,url,revoked_reason',
      `'=Cy,cy@example.org,${missing.code},active,2026-11-18,1,https://example.org/certs/c/${missing.code},`,
      `Ada / Lovelace,ada@example.org,${ada.code},active,2026-11-18,1,https://example.org/certs/c/${ada.code},`,
      `Bob,bob@example.org,${revoked.code},revoked,2026-11-18,1,https://example.org/certs/c/${revoked.code},"Duplicate, sent twice"`,
      '',
    ]);
  });
});
