import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { ConfigFileProcessor } from './config/file/ConfigFileProcessor';
import { Server } from './app/Server';
import { createDatabase } from './database/createDatabase';

const DatabasePath = 'data/app.db';
const MigrationsFolder = 'drizzle';

const configResult = await ConfigFileProcessor.Instance.read();
const config = configResult.match({
  ok: (value) => value,
  err: (error) => {
    console.error(error.message);
    process.exit(1);
  },
});

mkdirSync(dirname(DatabasePath), { recursive: true });
const database = createDatabase({
  path: DatabasePath,
  migrationsFolder: MigrationsFolder,
});
database.start();

const server = Server.create(config);
server.start();
