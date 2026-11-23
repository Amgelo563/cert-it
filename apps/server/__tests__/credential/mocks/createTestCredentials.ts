import type { SiteUrl } from '@cert-it/hono';
import { CredentialService } from '../../../src/credential/CredentialService';
import { CredentialSigner } from '../../../src/credential/CredentialSigner';
import { OpenBadgeBuilder } from '../../../src/credential/OpenBadgeBuilder';
import type { DatabaseService } from '../../../src/database/DatabaseService';
import { MessagesService } from '../../../src/i18n/MessagesService';
import { StubIssuerKeyService } from './StubIssuerKeyService';

/** The org name the credentials name as issuer. */
export const CredentialOrgName = 'Acme Institute';

/** The credential services, signing with the shared test key. */
export function createTestCredentials(
  database: DatabaseService,
  siteUrl: SiteUrl,
): {
  keys: StubIssuerKeyService;
  builder: OpenBadgeBuilder;
  signer: CredentialSigner;
  service: CredentialService;
} {
  const keys = new StubIssuerKeyService();
  const builder = new OpenBadgeBuilder({
    siteUrl,
    orgName: CredentialOrgName,
    messages: new MessagesService(),
  });
  const signer = new CredentialSigner({ keys, builder });

  return {
    keys,
    builder,
    signer,
    service: new CredentialService({ database, signer, builder }),
  };
}
