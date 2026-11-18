import { Hono } from 'hono';
import type { Config } from '../config/schema/ConfigSchema';
import { serve } from '@hono/node-server';

export class Server {
  protected readonly app: Hono;

  protected readonly port: number;

  constructor(app: Hono, port: number) {
    this.app = app;
    this.port = port;
  }

  public static create(config: Config) {
    const app = new Hono();
    return new Server(app, config.server.port);
  }

  public start() {
    this.app.get('/', (c) => {
      return c.text('Hello Hono!');
    });

    serve(
      {
        fetch: this.app.fetch,
        port: this.port,
      },
      (info) => {
        console.log(`Server is running on http://localhost:${info.port}`);
      },
    );
  }
}
