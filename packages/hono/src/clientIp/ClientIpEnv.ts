/** The Hono environment of routes behind {@link ClientIpResolver.middleware}. */
export type ClientIpEnv = {
  Variables: {
    /** Client IP of the request, from the connection or a trusted proxy. */
    clientIp: string;
  };
};
