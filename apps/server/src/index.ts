import { ConfigFileProcessor } from './config/file/ConfigFileProcessor';
import { Server } from './app/Server';

const configResult = await ConfigFileProcessor.Instance.read();
const config = configResult.match({
  ok: (value) => value,
  err: (error) => {
    console.error(error.message);
    process.exit(1);
  },
});

const server = Server.create(config);
server.start();
