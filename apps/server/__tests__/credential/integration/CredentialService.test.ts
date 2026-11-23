import type { JsonWebKey } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { CertificateStatusEnum, LocaleEnum } from '@cert-it/shared';
import { afterEach, beforeEach, describe, expect, test } from 'vite-plus/test';
import type { Certificate } from '../../../src/certificate/Certificate';
import type { DatabaseService } from '../../../src/database/DatabaseService';
import { createTestDatabase } from '../../database/mocks/createTestDatabase';
import { MockSeeder } from '../../database/mocks/MockSeeder';
import { createApiHarness } from '../../http/mocks/createApiHarness';
import { CredentialOrgName } from '../mocks/createTestCredentials';
import { StubIssuerKeyService } from '../mocks/StubIssuerKeyService';
import { verifyJwt } from '../mocks/verifyJwt';

const Base = 'https://example.org/certs';

let database: DatabaseService;
let seeder: MockSeeder;
let harness: ReturnType<typeof createApiHarness>;

beforeEach(() => {
  database = createTestDatabase();
  seeder = new MockSeeder(database.getRepositories());
  harness = createApiHarness(database);
});

afterEach(() => {
  database.close();
});

function issue(
  options: { name?: string; locale?: typeof LocaleEnum.Es } = {},
): Certificate {
  const course = seeder.course({
    name: 'Applied Statistics',
    locale: options.locale,
  });
  return seeder.certificate(
    seeder.participant(course, { name: options.name ?? 'Jürgen Müller' }),
    seeder.templateVersion(course, seeder.user()),
  );
}

function revoke(certificate: Certificate): void {
  database
    .getRepositories()
    .certificates.update(certificate.id, {
      status: CertificateStatusEnum.Revoked,
      revokedAt: new Date(),
      revokedReason: 'Test',
    })
    .unwrap();
}

// fetches the key the way a verifier does: from the kid in the token's header
async function verify(jwt: string) {
  const { kid } = JSON.parse(
    Buffer.from(jwt.split('.')[0]!, 'base64url').toString('utf8'),
  ) as { kid: string };
  expect(kid.startsWith(`${Base}/`)).toBe(true);

  const response = await harness.requestPublic(kid.slice(Base.length));
  expect(response.status).toBe(200);
  return verifyJwt(jwt, (await response.json()) as JsonWebKey);
}

// whether each index is revoked, read as the Bitstring Status List spec says
async function readStatusList(): Promise<(index: number) => boolean> {
  const response = await harness.requestPublic(
    '/credentials/status/revocation',
  );
  const { payload } = await verify(await response.text());
  const encoded = payload['credentialSubject'].encodedList as string;
  expect(encoded[0]).toBe('u');

  const bits = gunzipSync(Buffer.from(encoded.slice(1), 'base64url'));
  expect(bits.length * 8).toBeGreaterThanOrEqual(131_072);
  return (index) => (bits[index >> 3]! & (0x80 >> (index & 7))) !== 0;
}

describe('CredentialService (GET /c/:code/credential)', () => {
  test('GIVEN an active certificate WHEN downloading its credential THEN serves a signed OpenBadgeCredential as an attachment', async () => {
    const certificate = issue();

    const response = await harness.requestPublic(
      `/c/${certificate.code}/credential`,
    );
    const { header, payload } = await verify(await response.text());

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/jwt');
    expect(response.headers.get('content-disposition')).toMatch(
      new RegExp(`^attachment; filename="${certificate.code}\\.jwt"`),
    );
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
    expect(header).toMatchObject({ alg: 'RS256', typ: 'JWT' });
    expect(payload).toMatchObject({
      '@context': [
        'https://www.w3.org/ns/credentials/v2',
        'https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json',
      ],
      id: `${Base}/c/${certificate.code}`,
      type: ['VerifiableCredential', 'OpenBadgeCredential'],
      name: 'Applied Statistics',
      issuer: {
        id: `${Base}/issuer`,
        type: ['Profile'],
        name: CredentialOrgName,
      },
      validFrom: '2026-11-18T00:00:00Z',
      credentialSubject: {
        type: ['AchievementSubject'],
        identifier: [
          {
            type: 'IdentityObject',
            identityType: 'name',
            hashed: false,
            identityHash: 'Jürgen Müller',
          },
        ],
        achievement: {
          id: `${Base}/achievements/${certificate.courseId}`,
          type: ['Achievement'],
          name: 'Applied Statistics',
          description: `Certificate for Applied Statistics, issued by ${CredentialOrgName}.`,
          criteria: {
            narrative: `Awarded by ${CredentialOrgName} to participants of Applied Statistics.`,
          },
        },
      },
      credentialStatus: {
        type: 'BitstringStatusListEntry',
        statusPurpose: 'revocation',
        statusListIndex: String(certificate.id),
        statusListCredential: `${Base}/credentials/status/revocation`,
      },
      iss: `${Base}/issuer`,
      jti: `${Base}/c/${certificate.code}`,
      nbf: Date.parse('2026-11-18T00:00:00Z') / 1000,
    });
  });

  test('GIVEN an active certificate WHEN downloading its credential THEN never includes the email', async () => {
    const certificate = issue();

    const response = await harness.requestPublic(
      `/c/${certificate.code}/credential`,
    );
    const { payload } = await verify(await response.text());

    expect(JSON.stringify(payload)).not.toContain('@example.org');
  });

  test('GIVEN a Spanish course WHEN downloading its credential THEN describes the achievement in Spanish', async () => {
    const certificate = issue({ locale: LocaleEnum.Es });

    const response = await harness.requestPublic(
      `/c/${certificate.code}/credential`,
    );
    const { payload } = await verify(await response.text());

    expect(payload['credentialSubject'].achievement).toMatchObject({
      description: `Certificado de Applied Statistics, emitido por ${CredentialOrgName}.`,
      inLanguage: 'es',
    });
  });

  test('GIVEN a revoked certificate WHEN downloading its credential THEN answers 404, not cached', async () => {
    const certificate = issue();
    revoke(certificate);

    const response = await harness.requestPublic(
      `/c/${certificate.code}/credential`,
    );

    expect(response.status).toBe(404);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  test('GIVEN an unknown code WHEN downloading its credential THEN answers 404', async () => {
    const response = await harness.requestPublic('/c/NOPE-NOPE-NO/credential');

    expect(response.status).toBe(404);
  });
});

describe('CredentialService (issuer)', () => {
  test('GIVEN the issuer URL WHEN fetching it THEN serves its Open Badges profile', async () => {
    const response = await harness.requestPublic('/issuer');

    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
    expect(await response.json()).toEqual({
      '@context': [
        'https://www.w3.org/ns/credentials/v2',
        'https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json',
      ],
      id: `${Base}/issuer`,
      type: ['Profile'],
      name: CredentialOrgName,
      url: `${Base}/`,
    });
  });

  test('GIVEN the current key URL WHEN fetching it THEN serves the public JWK, without private members', async () => {
    const key = StubIssuerKeyService.sharedKey();
    const url = `/issuer/keys/${key.getThumbprint()}`;

    const response = await harness.requestPublic(url);

    expect(await response.json()).toEqual({
      ...key.getPublicJwk(),
      kid: `${Base}${url}`,
      alg: 'RS256',
      use: 'sig',
    });
  });

  test('GIVEN another thumbprint WHEN fetching its key THEN answers 404', async () => {
    const response = await harness.requestPublic('/issuer/keys/unknown');

    expect(response.status).toBe(404);
  });
});

describe('CredentialService (GET /achievements/:courseId)', () => {
  test('GIVEN a course with an active certificate WHEN fetching its achievement THEN serves it', async () => {
    const certificate = issue();

    const response = await harness.requestPublic(
      `/achievements/${certificate.courseId}`,
    );

    expect(await response.json()).toMatchObject({
      id: `${Base}/achievements/${certificate.courseId}`,
      type: ['Achievement'],
      name: 'Applied Statistics',
    });
  });

  test('GIVEN a course without active certificates WHEN fetching its achievement THEN answers 404', async () => {
    const certificate = issue();
    revoke(certificate);
    const empty = seeder.course();

    for (const id of [certificate.courseId, empty.id, 'abc']) {
      const response = await harness.requestPublic(`/achievements/${id}`);
      expect(response.status).toBe(404);
    }
  });
});

describe('CredentialService (GET /credentials/status/revocation)', () => {
  test('GIVEN active, revoked and deleted certificates WHEN reading the status list THEN only active ones are not revoked', async () => {
    const active = issue();
    const revoked = issue();
    revoke(revoked);
    const deleted = issue();
    database.getRepositories().certificates.delete(deleted.id).unwrap();

    const isRevoked = await readStatusList();

    expect(isRevoked(active.id)).toBe(false);
    expect(isRevoked(revoked.id)).toBe(true);
    expect(isRevoked(deleted.id)).toBe(true);
  });

  test('GIVEN a revoked certificate WHEN it is reinstated THEN the status list shows it active again', async () => {
    const certificate = issue();
    revoke(certificate);
    database
      .getRepositories()
      .certificates.update(certificate.id, {
        status: CertificateStatusEnum.Active,
        revokedAt: null,
        revokedReason: null,
      })
      .unwrap();

    expect((await readStatusList())(certificate.id)).toBe(false);
  });

  test('GIVEN the status list WHEN fetching it THEN is a signed BitstringStatusListCredential, revalidated on every fetch', async () => {
    issue();

    const response = await harness.requestPublic(
      '/credentials/status/revocation',
    );
    const { payload } = await verify(await response.text());

    expect(response.headers.get('content-type')).toBe('application/jwt');
    expect(response.headers.get('cache-control')).toBe('no-cache');
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
    expect(payload).toMatchObject({
      id: `${Base}/credentials/status/revocation`,
      type: ['VerifiableCredential', 'BitstringStatusListCredential'],
      issuer: `${Base}/issuer`,
      credentialSubject: {
        id: `${Base}/credentials/status/revocation#list`,
        type: 'BitstringStatusList',
        statusPurpose: 'revocation',
      },
    });
  });
});
