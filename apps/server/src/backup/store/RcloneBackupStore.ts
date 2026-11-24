import { spawn } from 'node:child_process';
import type { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { BackupStore } from './BackupStore';

type RcloneBackupStoreOptions = {
  /** @default 'rclone' */
  command?: string;
  /** Arguments put before every command. @default [] */
  globalArgs?: readonly string[];
};

type RunOptions = {
  input?: Readable;
  signal?: AbortSignal;
};

/** A backup store that runs the rclone command, with the remotes defined in its config file. */
export class RcloneBackupStore implements BackupStore {
  protected static readonly MaxErrorLength = 2000;

  protected readonly command: string;

  protected readonly globalArgs: readonly string[];

  constructor(options: RcloneBackupStoreOptions) {
    this.command = options.command ?? 'rclone';
    this.globalArgs = options.globalArgs ?? [];
  }

  public static create(options?: {
    injections?: Partial<RcloneBackupStoreOptions>;
  }): RcloneBackupStore {
    return new RcloneBackupStore({ ...options?.injections });
  }

  public async check(remotes: readonly string[]): Promise<void> {
    const output = await this.run(['listremotes']);
    const defined = new Set(output.split(/\r?\n/).filter(Boolean));

    for (const remote of remotes) {
      const name = remote.slice(0, remote.indexOf(':') + 1);
      if (!defined.has(name)) {
        throw new Error(
          `rclone has no remote named ${name.slice(0, -1)}; define it in its config file`,
        );
      }
    }
  }

  public async upload(
    remote: string,
    name: string,
    content: Readable,
    signal?: AbortSignal,
  ): Promise<void> {
    await this.run(['rcat', this.join(remote, name)], {
      input: content,
      signal,
    });
  }

  public async list(remote: string, signal?: AbortSignal): Promise<string[]> {
    const output = await this.run(
      ['lsf', '--files-only', '--max-depth', '1', remote],
      { signal },
    );

    return output.split(/\r?\n/).filter(Boolean);
  }

  public async delete(
    remote: string,
    name: string,
    signal?: AbortSignal,
  ): Promise<void> {
    await this.run(['deletefile', this.join(remote, name)], { signal });
  }

  // a remote root or folder ending in a slash takes the name as is
  protected join(remote: string, name: string): string {
    return remote.endsWith(':') || remote.endsWith('/')
      ? `${remote}${name}`
      : `${remote}/${name}`;
  }

  // resolves with stdout, or rejects with the end of stderr
  protected async run(
    args: string[],
    options: RunOptions = {},
  ): Promise<string> {
    const { input, signal } = options;
    const child = spawn(this.command, [...this.globalArgs, ...args], {
      stdio: [input ? 'pipe' : 'ignore', 'pipe', 'pipe'],
      signal,
    });

    let stdout = '';
    let stderr = '';
    child.stdout?.setEncoding('utf8').on('data', (chunk: string) => {
      stdout += chunk;
    });
    child.stderr?.setEncoding('utf8').on('data', (chunk: string) => {
      stderr = (stderr + chunk).slice(-RcloneBackupStore.MaxErrorLength);
    });

    const exited = new Promise<number | null>((resolve, reject) => {
      child.once('error', (error: NodeJS.ErrnoException) => {
        reject(
          error.code === 'ENOENT'
            ? new Error(`${this.command} isn't installed or isn't on the PATH`)
            : error,
        );
      });
      child.once('close', resolve);
    });

    // a failed read stops rclone, so it doesn't finish a truncated file
    let inputError: unknown = null;
    const piped =
      input && child.stdin
        ? pipeline(input, child.stdin).catch((error: unknown) => {
            inputError = error;
            child.kill();
          })
        : null;

    const code = await exited;
    await piped;
    if (code === 0 && inputError === null) return stdout;

    // rclone's own message wins over the broken pipe it leaves behind
    const detail = stderr.trim();
    if (!detail && inputError !== null) throw inputError;
    throw new Error(
      `rclone ${args[0]} failed: ${detail || `exit code ${code}`}`,
    );
  }
}
