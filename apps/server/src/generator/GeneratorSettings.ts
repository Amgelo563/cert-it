/** What the generator process needs from the server, passed as its first argument in JSON. */
export type GeneratorSettings = {
  /** Path of the server's database file. */
  readonly databasePath: string;
  /** Path of the data directory. */
  readonly dataDir: string;
  /** Public address of the app, for the URLs in QR codes and credentials. */
  readonly baseUrl: string;
  /** Name of the issuing organization, for the credentials. */
  readonly orgName: string;
};
