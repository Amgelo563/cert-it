import {
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  type KeyObject,
  sign,
} from 'node:crypto';

/** The public half of an issuer key, as a JWK with only the members its thumbprint covers. */
export type IssuerPublicJwk = {
  readonly kty: 'RSA';
  readonly n: string;
  readonly e: string;
};

type IssuerKeyOptions = {
  privateKey: KeyObject;
};

/** The RSA key the issuer signs verifiable credentials with, as RS256 JWTs. */
export class IssuerKey {
  // RS256 is the one algorithm every Open Badges 3.0 verifier supports
  public static readonly Algorithm = 'RS256';

  protected static readonly ModulusBits = 2048;

  protected readonly privateKey: KeyObject;

  protected readonly publicJwk: IssuerPublicJwk;

  protected readonly thumbprint: string;

  constructor(options: IssuerKeyOptions) {
    this.privateKey = options.privateKey;
    const { kty, n, e } = createPublicKey(this.privateKey).export({
      format: 'jwk',
    });
    if (kty !== 'RSA' || !n || !e) {
      throw new Error('The issuer key must be an RSA key.');
    }

    this.publicJwk = { kty, n, e };
    // RFC 7638: the required members, in lexicographic order, without spaces
    this.thumbprint = createHash('sha256')
      .update(JSON.stringify({ e, kty, n }))
      .digest('base64url');
  }

  /** Creates a new random key. */
  public static generate(): IssuerKey {
    const { privateKey } = generateKeyPairSync('rsa', {
      modulusLength: IssuerKey.ModulusBits,
    });
    return new IssuerKey({ privateKey });
  }

  /**
   * Reads a key from a PKCS#8 PEM.
   *
   * @throws {Error} If the PEM isn't an RSA private key.
   */
  public static fromPem(pem: string): IssuerKey {
    return new IssuerKey({ privateKey: createPrivateKey(pem) });
  }

  /** Returns the private key as a PKCS#8 PEM. */
  public toPem(): string {
    return this.privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
  }

  /** Returns the public key, without the private members. */
  public getPublicJwk(): IssuerPublicJwk {
    return this.publicJwk;
  }

  /** Returns the RFC 7638 thumbprint of the public key, which names it in key URLs. */
  public getThumbprint(): string {
    return this.thumbprint;
  }

  /** Signs a payload as a compact JWS, with the given key URL as its `kid`. RS256 is deterministic, so the same payload always gives the same token. */
  public signJwt(keyUrl: string, payload: Readonly<Record<string, unknown>>) {
    const header = { alg: IssuerKey.Algorithm, typ: 'JWT', kid: keyUrl };
    const input = `${IssuerKey.encode(header)}.${IssuerKey.encode(payload)}`;
    const signature = sign('sha256', Buffer.from(input), this.privateKey);
    return `${input}.${signature.toString('base64url')}`;
  }

  protected static encode(value: unknown): string {
    return Buffer.from(JSON.stringify(value)).toString('base64url');
  }
}
