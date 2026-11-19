import { describe, expect, test } from 'vite-plus/test';
import { PasswordHasher } from '../../../../src/auth/password/PasswordHasher';

const hasher = new PasswordHasher();

describe('PasswordHasher (hash)', () => {
  test('GIVEN a password WHEN hashing THEN returns an argon2id hash that verifies', async () => {
    const hash = await hasher.hash('correct horse');

    expect(hash).toMatch(/^\$argon2id\$/);
    await expect(hasher.verify(hash, 'correct horse')).resolves.toBe(true);
  });

  test('GIVEN a hash WHEN verifying a different password THEN returns false', async () => {
    const hash = await hasher.hash('correct horse');

    await expect(hasher.verify(hash, 'battery staple')).resolves.toBe(false);
  });

  test('GIVEN a malformed hash WHEN verifying THEN returns false', async () => {
    await expect(hasher.verify('hash', 'anything')).resolves.toBe(false);
  });
});

describe('PasswordHasher (generate)', () => {
  test('GIVEN two calls WHEN generating THEN returns different 16-character passwords', () => {
    const first = hasher.generate();
    const second = hasher.generate();

    expect(first).toMatch(/^[\w-]{16}$/);
    expect(second).not.toBe(first);
  });
});
