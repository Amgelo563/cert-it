import { HttpService } from './app/HttpService';
import { ConfigService } from './config/file/ConfigService';
import { DatabaseService } from './database/DatabaseService';
import { DataDirectoryService } from './storage/DataDirectoryService';

const config = await ConfigService.create().readOrExit();
const dataDirectory = new DataDirectoryService({ root: config.server.dataDir });
const database = new DatabaseService({ path: dataDirectory.getDatabasePath() });
const http = HttpService.create(config);

try {
  dataDirectory.start();
  database.start();
  http.start();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    http.stop().then(
      () => {
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
