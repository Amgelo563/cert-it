/** What the generator process needs from the server, passed as its first argument in JSON. */
export type GeneratorSettings = {
  /** Path of the server's database file. */
  readonly databasePath: string;
  /** Path of the data directory. */
  readonly dataDir: string;
  /** Public address of the app, for the URLs in QR codes. */
  readonly baseUrl: string;
};
