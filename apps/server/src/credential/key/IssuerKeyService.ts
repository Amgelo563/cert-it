import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { ManagedDirectory } from '@cert-it/file';
import { StartupError } from '../../error/StartupError';
import { IssuerKey } from './IssuerKey';
import type { DataDirectoryService } from '../../storage/DataDirectoryService';
import { ConsoleLogger } from '../../log/ConsoleLogger';
import type { Logger } from '../../log/Logger';

type IssuerKeyServiceOptions = {
  /** Path of the PEM file, inside the data directory so backups keep it. */
  path: string;
  /** Whether a missing key is created. Only the server creates it; the generator reads it. */
  createMissing: boolean;
  logger: Logger;
};

/** Keeps the issuer's signing key in the data directory, creating it on the server's first start. */
export class IssuerKeyService {
  // readable only by the app's user
  protected static readonly FileMode = 0o600;

  protected readonly path: string;

  protected readonly createMissing: boolean;

  protected readonly logger: Logger;

  protected key: IssuerKey | null = null;

  constructor(options: IssuerKeyServiceOptions) {
    this.path = options.path;
    this.createMissing = options.createMissing;
    this.logger = options.logger;
  }

  public static create(options: {
    dataDirectory: DataDirectoryService;
    createMissing: boolean;
    injections?: Partial<Pick<IssuerKeyServiceOptions, 'path' | 'logger'>>;
  }): IssuerKeyService {
    const { dataDirectory, createMissing, injections } = options;

    return new IssuerKeyService({
      path: injections?.path ?? dataDirectory.getIssuerKeyPath(),
      createMissing,
      logger: injections?.logger ?? ConsoleLogger.Instance,
    });
  }

  /**
   * Reads the key, creating it first if it's missing and this service may.
   *
   * @throws {StartupError} If the key can't be read, created or parsed.
   */
  public async start(): Promise<void> {
    try {
      this.key = await this.read();
    } catch (error) {
      throw new StartupError(`Couldn't load the issuer key at ${this.path}`, {
        cause: error,
      });
    }
  }

  /**
   * Returns the key.
   *
   * @throws {Error} If the service isn't started.
   */
  public getKey(): IssuerKey {
    if (!this.key) throw new Error('IssuerKeyService is not started.');
    return this.key;
  }

  protected async read(): Promise<IssuerKey> {
    const pem = await readFile(this.path, 'utf8').catch((error: unknown) => {
      if (this.createMissing && IssuerKeyService.isMissing(error)) return null;
      throw error;
    });
    if (pem !== null) return IssuerKey.fromPem(pem);

    const key = IssuerKey.generate();
    await this.write(key.toPem());
    this.logger.info(`Created the issuer signing key at ${this.path}.`);
    return key;
  }

  // the temporary name ends like the data directory's, so a crash leaves nothing it doesn't clean
  protected async write(pem: string): Promise<void> {
    const temp = `${this.path}.${randomUUID()}${ManagedDirectory.TempFileSuffix}`;
    try {
      await mkdir(dirname(this.path), { recursive: true });
      await writeFile(temp, pem, {
        mode: IssuerKeyService.FileMode,
        flush: true,
      });
      await rename(temp, this.path);
    } catch (error) {
      await rm(temp, { force: true });
      throw error;
    }
  }

  protected static isMissing(error: unknown): boolean {
    return (error as NodeJS.ErrnoException | null)?.code === 'ENOENT';
  }
}
