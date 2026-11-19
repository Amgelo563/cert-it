import { randomBytes } from 'node:crypto';
import { hash, verify } from '@node-rs/argon2';

/** Hashes and checks admin panel passwords with argon2id. */
export class PasswordHasher {
  // 12 bytes give 16 base64url characters
  protected static readonly GeneratedPasswordBytes = 12;

  /** Returns the argon2id hash of the given password. */
  public hash(password: string): Promise<string> {
    return hash(password);
  }

  /** Returns whether the password matches the hash, false for a malformed hash. */
  public async verify(
    passwordHash: string,
    password: string,
  ): Promise<boolean> {
    try {
      return await verify(passwordHash, password);
    } catch {
      return false;
    }
  }

  /** Returns a random password for a new or reset account. */
  public generate(): string {
    return randomBytes(PasswordHasher.GeneratedPasswordBytes).toString(
      'base64url',
    );
  }
}
