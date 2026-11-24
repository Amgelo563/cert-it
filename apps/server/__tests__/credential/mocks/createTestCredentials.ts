import type { SiteUrl } from '@cert-it/hono';
import { CredentialRoutes } from '../../../src/credential/CredentialRoutes';
import { CredentialSigner } from '../../../src/credential/CredentialSigner';
import { OpenBadgeBuilder } from '../../../src/credential/OpenBadgeBuilder';
import type { DatabaseService } from '../../../src/database/DatabaseService';
import { MessageCatalog } from '../../../src/i18n/MessageCatalog';
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
  service: CredentialRoutes;
} {
  const keys = new StubIssuerKeyService();
  const builder = new OpenBadgeBuilder({
    siteUrl,
    orgName: CredentialOrgName,
    messages: new MessageCatalog(),
  });
  const signer = new CredentialSigner({ keys, builder });

  return {
    keys,
    builder,
    signer,
    service: new CredentialRoutes({ database, signer, builder }),
  };
}
