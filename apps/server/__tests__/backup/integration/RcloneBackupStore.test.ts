import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { afterEach, describe, expect, test } from 'vite-plus/test';
import { RcloneBackupStore } from '../../../src/backup/store/RcloneBackupStore';
import { backupStoreContract } from '../contract/backupStoreContract';

const HasRclone = spawnSync('rclone', ['version']).status === 0;

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

// a store whose command is a node script, standing in for rclone
function scripted(script: string): RcloneBackupStore {
  return new RcloneBackupStore({
    command: process.execPath,
    globalArgs: ['-e', script],
  });
}

describe.skipIf(!HasRclone)('RcloneBackupStore (contract)', () => {
  backupStoreContract(() => {
    const root = mkdtempSync(join(tmpdir(), 'cert-it-rclone-'));
    roots.push(root);
    const config = join(root, 'rclone.conf');
    writeFileSync(config, '[backups]\ntype = local\n');

    return {
      store: new RcloneBackupStore({ globalArgs: ['--config', config] }),
      remote: `backups:${join(root, 'remote')}`,
    };
  });
});

describe('RcloneBackupStore (errors)', () => {
  test('GIVEN a missing command WHEN checked THEN says it is not installed', async () => {
    const store = new RcloneBackupStore({ command: 'cert-it-no-such-rclone' });

    await expect(store.check(['s3:bucket'])).rejects.toThrow(
      "cert-it-no-such-rclone isn't installed",
    );
  });

  test('GIVEN a command that fails WHEN run THEN includes its error output', async () => {
    const store = scripted(
      'process.stderr.write("bucket not found"); process.exit(3)',
    );

    await expect(store.list('s3:bucket')).rejects.toThrow(
      'rclone lsf failed: bucket not found',
    );
  });

  test('GIVEN listed remotes WHEN checking one that is missing THEN names it', async () => {
    const store = scripted('console.log("s3:"); console.log("gdrive:")');

    await expect(
      store.check(['s3:bucket', 'gdrive:']),
    ).resolves.toBeUndefined();
    await expect(store.check(['dropbox:certs'])).rejects.toThrow(
      'no remote named dropbox',
    );
  });

  test('GIVEN an upload WHEN its stream fails THEN throws the read error', async () => {
    // reads stdin until it ends, as rcat does
    const store = scripted('process.stdin.resume()');
    const content = new Readable({
      read() {
        this.destroy(new Error('read failed'));
      },
    });

    await expect(store.upload('s3:bucket', 'a.zip', content)).rejects.toThrow(
      'read failed',
    );
  });
});
