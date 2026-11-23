import type { Readable } from 'node:stream';

/** Where backup archives are kept, on remotes given as a name and a path. */
export interface BackupStore {
  /**
   * Checks that every remote is set up, without connecting to it.
   *
   * @throws {Error} If the store can't be used or a remote isn't defined.
   */
  check(remotes: readonly string[]): Promise<void>;

  /**
   * Uploads a file to a remote, read from the given stream.
   *
   * @throws {Error} If the upload fails or is aborted; a partial file may be left behind.
   */
  upload(
    remote: string,
    name: string,
    content: Readable,
    signal?: AbortSignal,
  ): Promise<void>;

  /**
   * Returns the names of the files in a remote's folder, not its subfolders.
   *
   * @throws {Error} If the folder can't be listed.
   */
  list(remote: string, signal?: AbortSignal): Promise<string[]>;

  /**
   * Deletes a file from a remote.
   *
   * @throws {Error} If the file can't be deleted.
   */
  delete(remote: string, name: string, signal?: AbortSignal): Promise<void>;
}
