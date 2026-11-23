import { Readable } from 'node:stream';
import { expect, test } from 'vite-plus/test';
import type { BackupStore } from '../../../src/backup/store/BackupStore';

/** A store with one defined remote, as each factory makes it. */
export type BackupStoreSetup = {
  store: BackupStore;
  /** A remote and folder the store can write to. */
  remote: string;
};

/** Checks the behavior backups rely on from every {@link BackupStore}. */
export function backupStoreContract(setup: () => BackupStoreSetup): void {
  test('GIVEN a defined remote WHEN checked THEN passes', async () => {
    const { store, remote } = setup();

    await expect(store.check([remote])).resolves.toBeUndefined();
  });

  test('GIVEN an undefined remote WHEN checked THEN throws', async () => {
    const { store, remote } = setup();

    await expect(store.check([remote, 'missing:folder'])).rejects.toThrow(
      'missing',
    );
  });

  test('GIVEN an uploaded file WHEN listed THEN includes it', async () => {
    const { store, remote } = setup();

    await store.upload(remote, 'a.zip', Readable.from([Buffer.from('a')]));
    await store.upload(remote, 'b.zip', Readable.from([Buffer.from('b')]));

    expect((await store.list(remote)).toSorted()).toEqual(['a.zip', 'b.zip']);
  });

  test('GIVEN a deleted file WHEN listed THEN leaves it out', async () => {
    const { store, remote } = setup();
    await store.upload(remote, 'a.zip', Readable.from([Buffer.from('a')]));
    await store.upload(remote, 'b.zip', Readable.from([Buffer.from('b')]));

    await store.delete(remote, 'a.zip');

    expect(await store.list(remote)).toEqual(['b.zip']);
  });

  test('GIVEN a stream that fails WHEN uploading THEN throws', async () => {
    const { store, remote } = setup();
    const content = new Readable({
      read() {
        this.destroy(new Error('read failed'));
      },
    });

    await expect(store.upload(remote, 'a.zip', content)).rejects.toThrow(
      'read failed',
    );
  });
}
