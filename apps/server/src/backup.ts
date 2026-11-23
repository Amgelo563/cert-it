// takes one backup now, next to the running server; exits with 1 if any remote failed
import { BackupService } from './backup/BackupService';
import { ConfigService } from './config/file/ConfigService';
import { DatabaseService } from './database/DatabaseService';
import { DataDirectoryService } from './storage/DataDirectoryService';

const config = await ConfigService.create().readOrExit();
if (config.backup.remotes.length === 0) {
  console.error('No backup remotes are set in the config file.');
  process.exit(1);
}

const dataDirectory = new DataDirectoryService({ root: config.server.dataDir });
// the server applies migrations, not this
const database = new DatabaseService({
  path: dataDirectory.getDatabasePath(),
  migrate: false,
});
const backups = BackupService.create({ config, database, dataDirectory });

try {
  database.start();
  await backups.check();
  const { name, uploaded, failed } = await backups.run();
  console.log(
    `Backup ${name}: uploaded to ${uploaded.length} of ${uploaded.length + failed.length} remotes`,
  );
  process.exitCode = failed.length > 0 ? 1 : 0;
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  database.close();
}
