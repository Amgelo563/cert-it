import { buffer } from 'node:stream/consumers';
import type { Readable } from 'node:stream';
import type { BackupStore } from '../../../src/backup/store/BackupStore';

type MockBackupStoreOptions = {
  /** Names of the defined remotes, such as s3. */
  defined: readonly string[];
};

/** An in-memory backup store, whose remotes can be told to fail. */
export class MockBackupStore implements BackupStore {
  protected readonly defined: ReadonlySet<string>;

  protected readonly files = new Map<string, Map<string, Buffer>>();

  protected readonly failing = new Set<string>();

  constructor(options: MockBackupStoreOptions) {
    this.defined = new Set(options.defined);
  }

  public async check(remotes: readonly string[]): Promise<void> {
    await Promise.resolve();
    for (const remote of remotes) {
      const name = remote.slice(0, remote.indexOf(':'));
      if (!this.defined.has(name)) throw new Error(`No remote named ${name}`);
    }
  }

  public async upload(
    remote: string,
    name: string,
    content: Readable,
    signal?: AbortSignal,
  ): Promise<void> {
    signal?.throwIfAborted();
    const bytes = await buffer(content);
    if (this.failing.has(remote)) {
      // a partial file, as a failed upload may leave
      this.folder(remote).set(name, bytes.subarray(0, 10));
      throw new Error(`Upload to ${remote} failed`);
    }

    this.folder(remote).set(name, bytes);
  }

  public async list(remote: string, signal?: AbortSignal): Promise<string[]> {
    await Promise.resolve();
    signal?.throwIfAborted();
    return [...this.folder(remote).keys()];
  }

  public async delete(
    remote: string,
    name: string,
    signal?: AbortSignal,
  ): Promise<void> {
    await Promise.resolve();
    signal?.throwIfAborted();
    if (!this.folder(remote).delete(name)) {
      throw new Error(`No file ${name} on ${remote}`);
    }
  }

  /** Makes every later upload to a remote fail. */
  public failUploads(remote: string): this {
    this.failing.add(remote);
    return this;
  }

  /** Stores a file on a remote directly, such as an older backup. */
  public put(remote: string, name: string, content: Buffer): this {
    this.folder(remote).set(name, content);
    return this;
  }

  /** Returns a stored file, or undefined if there's none. */
  public getFile(remote: string, name: string): Buffer | undefined {
    return this.folder(remote).get(name);
  }

  protected folder(remote: string): Map<string, Buffer> {
    let folder = this.files.get(remote);
    if (!folder) {
      folder = new Map();
      this.files.set(remote, folder);
    }
    return folder;
  }
}
