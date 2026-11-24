import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vite-plus/test';
import { IssuerKeyService } from '../../../../src/credential/key/IssuerKeyService';
import { StartupError } from '../../../../src/error/StartupError';
import { MockLogger } from '../../../log/mocks/MockLogger';

let parent: string;
let path: string;
let lines: string[];

beforeEach(() => {
  parent = mkdtempSync(join(tmpdir(), 'cert-it-keys-'));
  path = join(parent, 'keys', 'issuer.pem');
  lines = [];
});

afterEach(() => {
  rmSync(parent, { recursive: true, force: true });
});

function createService(createMissing: boolean): IssuerKeyService {
  return new IssuerKeyService({
    path,
    createMissing,
    logger: new MockLogger({ lines }),
  });
}

describe('IssuerKeyService (start)', () => {
  test('GIVEN no key file WHEN the server starts THEN creates one and says so', async () => {
    const service = createService(true);

    await service.start();

    expect(readFileSync(path, 'utf8')).toBe(service.getKey().toPem());
    expect(lines).toEqual([`Created the issuer signing key at ${path}.`]);
  });

  // Windows has no Unix permission bits
  test.skipIf(process.platform === 'win32')(
    'GIVEN no key file WHEN the server creates it THEN only its owner can read it',
    async () => {
      await createService(true).start();

      expect(statSync(path).mode & 0o777).toBe(0o600);
    },
  );

  test('GIVEN a key file WHEN starting again THEN reads the same key', async () => {
    const first = createService(true);
    await first.start();
    const second = createService(true);

    await second.start();

    expect(second.getKey().getThumbprint()).toBe(
      first.getKey().getThumbprint(),
    );
    expect(lines).toHaveLength(1);
  });

  test('GIVEN no key file WHEN the generator starts THEN throws a StartupError without creating one', async () => {
    await expect(createService(false).start()).rejects.toThrow(StartupError);
    expect(existsSync(path)).toBe(false);
  });

  test('GIVEN a corrupt key file WHEN starting THEN throws a StartupError naming the path', async () => {
    const service = createService(true);
    await service.start();
    writeFileSync(path, 'garbage');

    await expect(createService(true).start()).rejects.toThrow(path);
  });

  test('GIVEN a service not started WHEN getting the key THEN throws', () => {
    expect(() => createService(true).getKey()).toThrow('not started');
  });
});
