import { gzipSync } from 'node:zlib';
import type { CertificateId } from '../certificate/Certificate';
import { IssuerKey } from './key/IssuerKey';
import type { IssuerKeyService } from './key/IssuerKeyService';
import { type CredentialSource, OpenBadgeBuilder } from './OpenBadgeBuilder';
import type { SiteUrl } from '@cert-it/hono';

type CredentialSignerOptions = {
  keys: IssuerKeyService;
  builder: OpenBadgeBuilder;
};

/** Signs the issuer's credentials as VC-JWTs, the Open Badges 3.0 JWT proof format. */
export class CredentialSigner {
  // the spec's minimum, so a list never tells how many certificates there are
  protected static readonly MinListBits = 131_072;

  protected readonly keys: IssuerKeyService;

  protected readonly builder: OpenBadgeBuilder;

  constructor(options: CredentialSignerOptions) {
    this.keys = options.keys;
    this.builder = options.builder;
  }

  public static create(options: {
    keys: IssuerKeyService;
    siteUrl: SiteUrl;
    orgName: string;
    injections?: Partial<Pick<CredentialSignerOptions, 'builder'>>;
  }): CredentialSigner {
    const { keys, siteUrl, orgName, injections } = options;

    return new CredentialSigner({
      keys,
      builder:
        injections?.builder ?? OpenBadgeBuilder.create({ siteUrl, orgName }),
    });
  }

  /** Returns the builder of the documents this signer signs. */
  public getBuilder(): OpenBadgeBuilder {
    return this.builder;
  }

  /** Returns a certificate's signed OpenBadgeCredential, as a compact JWS. The same data always gives the same token. */
  public signCertificate(source: CredentialSource): string {
    const credential = this.builder.buildCredential(source);
    const validFrom = Date.parse(credential['validFrom'] as string);

    return this.sign({
      ...credential,
      iss: this.builder.getIssuerUrl(),
      jti: credential['id'],
      nbf: Math.floor(validFrom / 1000),
    });
  }

  /** Returns the signed revocation status list: every index is revoked but those of the given active certificates. */
  public signStatusList(options: {
    activeIds: readonly CertificateId[];
    highestId: number;
  }): string {
    const list = this.builder.buildStatusList(this.encodeList(options));
    return this.sign({
      ...list,
      iss: this.builder.getIssuerUrl(),
      jti: list['id'],
    });
  }

  /** Returns the current public key as a JWK, with its URL as `kid`. */
  public getPublicJwk(): Readonly<Record<string, string>> {
    const key = this.keys.getKey();
    return {
      ...key.getPublicJwk(),
      kid: this.builder.getKeyUrl(key.getThumbprint()),
      alg: IssuerKey.Algorithm,
      use: 'sig',
    };
  }

  /** Returns the thumbprint of the current key, which ends its URL. */
  public getKeyThumbprint(): string {
    return this.keys.getKey().getThumbprint();
  }

  protected sign(payload: Readonly<Record<string, unknown>>): string {
    const key = this.keys.getKey();
    return key.signJwt(this.builder.getKeyUrl(key.getThumbprint()), payload);
  }

  // ones by default, so deleted certificates read as revoked; bit 0 is the first byte's highest bit
  protected encodeList(options: {
    activeIds: readonly CertificateId[];
    highestId: number;
  }): string {
    const { MinListBits } = CredentialSigner;
    const bits = Math.ceil((options.highestId + 1) / MinListBits) * MinListBits;
    const list = Buffer.alloc(bits / 8, 0xff);
    for (const id of options.activeIds) {
      list[id >> 3]! &= ~(0x80 >> (id & 7));
    }

    // multibase: the u prefix marks unpadded base64url
    return `u${gzipSync(list).toString('base64url')}`;
  }
}
