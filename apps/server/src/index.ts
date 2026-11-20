import { SiteUrl } from '@cert-it/hono';
import { AdminPanelService } from './admin/AdminPanelService';
import { AuthGuard } from './auth/AuthGuard';
import { AuthService } from './auth/AuthService';
import { PasswordHasher } from './auth/password/PasswordHasher';
import { SessionService } from './auth/session/SessionService';
import { CertificateFileService } from './certificate/file/CertificateFileService';
import { ConfigService } from './config/file/ConfigService';
import { DatabaseService } from './database/DatabaseService';
import { HttpService } from './http/HttpService';
import { DataDirectoryService } from './storage/DataDirectoryService';
import { UserService } from './user/UserService';

const config = await ConfigService.create().readOrExit();
const dataDirectory = new DataDirectoryService({ root: config.server.dataDir });
const database = new DatabaseService({ path: dataDirectory.getDatabasePath() });
const passwords = new PasswordHasher();
const sessions = new SessionService({
  database,
  siteUrl: new SiteUrl({ baseUrl: config.site.baseUrl }),
});
const guard = new AuthGuard({ sessions });
const users = UserService.create({
  config,
  database,
  passwords,
  sessions,
  guard,
});
const auth = AuthService.create({
  config,
  database,
  sessions,
  passwords,
  guard,
});
const adminPanel = AdminPanelService.create({ config });
const certificateFiles = CertificateFileService.create({
  config,
  database,
  dataDirectory,
});
const http = HttpService.create({
  config,
  database,
  adminPanel,
  certificateFiles,
  auth,
  users,
});

try {
  dataDirectory.start();
  database.start();
  await users.start();
  sessions.start();
  await adminPanel.start();
  await http.start();
} catch (error) {
  database.close();
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    http.stop().then(
      () => {
        sessions.stop();
        database.close();
        process.exit(0);
      },
      (error: unknown) => {
        console.error("Couldn't shut down cleanly:", error);
        process.exit(1);
      },
    );
  });
}
