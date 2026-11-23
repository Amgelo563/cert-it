import { describe, expect, test } from 'vite-plus/test';
import { IssuerKey } from '../../../../src/credential/key/IssuerKey';
import { StubIssuerKeyService } from '../../mocks/StubIssuerKeyService';
import { verifyJwt } from '../../mocks/verifyJwt';

const key = StubIssuerKeyService.sharedKey();

describe('IssuerKey (signJwt)', () => {
  test('GIVEN a payload WHEN signing THEN gives an RS256 JWT that its public key verifies', () => {
    const jwt = key.signJwt('https://example.org/issuer/keys/1', { a: 1 });

    expect(verifyJwt(jwt, key.getPublicJwk())).toEqual({
      header: {
        alg: 'RS256',
        typ: 'JWT',
        kid: 'https://example.org/issuer/keys/1',
      },
      payload: { a: 1 },
    });
  });

  test('GIVEN the same payload WHEN signing twice THEN gives the same token', () => {
    expect(key.signJwt('kid', { a: 1 })).toBe(key.signJwt('kid', { a: 1 }));
  });

  test('GIVEN a tampered payload WHEN verifying THEN fails', () => {
    const [header, , signature] = key.signJwt('kid', { a: 1 }).split('.');
    const forged = Buffer.from('{"a":2}').toString('base64url');

    expect(() =>
      verifyJwt(`${header}.${forged}.${signature}`, key.getPublicJwk()),
    ).toThrow('not valid');
  });
});

describe('IssuerKey (keys)', () => {
  test('GIVEN a key WHEN reading its PEM back THEN has the same public key and thumbprint', () => {
    const copy = IssuerKey.fromPem(key.toPem());

    expect(copy.getPublicJwk()).toEqual(key.getPublicJwk());
    expect(copy.getThumbprint()).toBe(key.getThumbprint());
  });

  test('GIVEN a key WHEN reading its public JWK THEN has no private members', () => {
    expect(Object.keys(key.getPublicJwk()).sort()).toEqual(['e', 'kty', 'n']);
    expect(key.getThumbprint()).toMatch(/^[\w-]{43}$/);
  });

  test('GIVEN text that is not a key WHEN parsing it THEN throws', () => {
    expect(() => IssuerKey.fromPem('not a key')).toThrow('DECODER');
  });
});
