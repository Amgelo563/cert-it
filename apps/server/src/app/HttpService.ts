import { Hono } from 'hono';
import type { Config } from '../config/schema/ConfigSchema';
import { serve, type ServerType } from '@hono/node-server';

export class HttpService {
  protected readonly app: Hono;

  protected readonly port: number;

  protected server: ServerType | null = null;

  constructor(app: Hono, port: number) {
    this.app = app;
    this.port = port;
  }

  public static create(config: Config) {
    const app = new Hono();
    return new HttpService(app, config.server.port);
  }

  public start() {
    this.app.get('/', (c) => {
      return c.text('Hello Hono!');
    });

    this.server = serve(
      {
        fetch: this.app.fetch,
        port: this.port,
      },
      (info) => {
        console.log(`Server is running on http://localhost:${info.port}`);
      },
    );
  }

  /** Stops accepting connections and waits for open requests to finish. */
  public stop(): Promise<void> {
    const { server } = this;
    if (!server) return Promise.resolve();

    this.server = null;
    return new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}
