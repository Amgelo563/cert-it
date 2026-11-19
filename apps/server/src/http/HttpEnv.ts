/** The Hono environment of the app's routes. */
export type HttpEnv = {
  Variables: {
    /** Client IP of the request, from the connection or a trusted proxy. */
    clientIp: string;
  };
};
