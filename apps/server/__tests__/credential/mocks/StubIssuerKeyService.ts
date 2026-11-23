import { IssuerKey } from '../../../src/credential/key/IssuerKey';
import { IssuerKeyService } from '../../../src/credential/key/IssuerKeyService';

/** An issuer key service that holds a key from the start, without a file. Tests share one key, since RSA keys are slow to generate. */
export class StubIssuerKeyService extends IssuerKeyService {
  protected static shared: IssuerKey | null = null;

  constructor(key = StubIssuerKeyService.sharedKey()) {
    super({ path: '', createMissing: false });
    this.key = key;
  }

  /** Returns the key every stub holds unless given another. */
  public static sharedKey(): IssuerKey {
    StubIssuerKeyService.shared ??= IssuerKey.generate();
    return StubIssuerKeyService.shared;
  }

  public override start(): Promise<void> {
    return Promise.resolve();
  }
}
