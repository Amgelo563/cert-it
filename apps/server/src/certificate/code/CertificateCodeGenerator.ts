import { randomBytes } from 'node:crypto';
import type { CertificateCode } from './CertificateCode';

type CertificateCodeGeneratorOptions = {
  /** Returns the given number of random bytes. @default crypto's randomBytes */
  random?: (size: number) => Uint8Array;
};

/** Creates random certificate codes in the `XXXX-XXXX-XX` format, from letters and digits that are hard to mistake for each other. */
export class CertificateCodeGenerator {
  /** No 0, O, 1 or I. With 32 symbols each random byte maps to one evenly. */
  public static readonly Alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  /** Lengths of the dash-separated groups of a code. */
  public static readonly GroupLengths: readonly number[] = [4, 4, 2];

  protected readonly random: (size: number) => Uint8Array;

  constructor(options: CertificateCodeGeneratorOptions = {}) {
    this.random = options.random ?? randomBytes;
  }

  /** Returns a new random code. It isn't checked against stored codes, so callers rely on the unique index. */
  public generate(): CertificateCode {
    const { Alphabet, GroupLengths } = CertificateCodeGenerator;
    const length = GroupLengths.reduce((sum, group) => sum + group, 0);
    const bytes = this.random(length);
    const symbols = Array.from(
      bytes,
      (byte) => Alphabet[byte % Alphabet.length]!,
    );

    let start = 0;
    const groups = GroupLengths.map((group) => {
      const part = symbols.slice(start, start + group).join('');
      start += group;
      return part;
    });

    return groups.join('-') as CertificateCode;
  }
}
