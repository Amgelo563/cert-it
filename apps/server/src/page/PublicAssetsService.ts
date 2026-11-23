import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { SiteUrl } from '@cert-it/hono';
import { serveStatic } from '@hono/node-server/serve-static';
import { type Context, Hono, type MiddlewareHandler } from 'hono';
import type { Config } from '../config/schema/ConfigSchema';
import { StartupError } from '../error/StartupError';
import type { HttpEnv } from '../http/HttpEnv';
import type { PublicPageAssets } from './PublicPageAssets';

type PublicAssetsServiceOptions = {
  /** Directory of the public pages' build (`apps/public/dist`), absolute or relative to the working directory. */
  directory: string;
  siteUrl: SiteUrl;
  /**
   * Reads the manifest again for every page, for a build in watch mode that renames its files.
   *
   * @default false
   */
  rereadManifest?: boolean;
};

type ManifestEntry = {
  file: string;
  name?: string;
  isEntry?: boolean;
  css?: string[];
};

/** Serves the scripts, styles and pdf.js files of the public pages under `{base_path}/static/`, and tells each page which ones to link. */
export class PublicAssetsService {
  /** Path the files are served under, relative to the base path. */
  public static readonly Path = '/static';

  // relative to the working directory, like the admin panel's build: apps/server in the repo
  protected static readonly DefaultDirectory = '../public/dist';

  protected static readonly ManifestPath = '.vite/manifest.json';

  // hashed by Vite, or under the pdf.js version, so their content never changes
  protected static readonly ServedFolders = ['/assets/', '/pdfjs/'];

  protected static readonly ImmutableCacheControl =
    'public, max-age=31536000, immutable';

  protected readonly directory: string;

  protected readonly siteUrl: SiteUrl;

  protected readonly rereadManifest: boolean;

  protected readonly app: Hono<HttpEnv>;

  /** Each page's files, by entry name, read at start. */
  protected entries: ReadonlyMap<string, PublicPageAssets> | null = null;

  constructor(options: PublicAssetsServiceOptions) {
    this.directory = resolve(options.directory);
    this.siteUrl = options.siteUrl;
    this.rereadManifest = options.rereadManifest ?? false;
    this.app = this.createApp();
  }

  public static create(options: {
    config: Config;
    injections?: Partial<PublicAssetsServiceOptions>;
  }): PublicAssetsService {
    const { config, injections } = options;

    return new PublicAssetsService({
      directory: injections?.directory ?? PublicAssetsService.DefaultDirectory,
      siteUrl:
        injections?.siteUrl ?? new SiteUrl({ baseUrl: config.site.baseUrl }),
      rereadManifest: injections?.rereadManifest,
    });
  }

  /**
   * Reads the build's manifest.
   *
   * @throws {StartupError} If the build is missing, such as when `apps/public` wasn't built.
   */
  public start(): void {
    this.entries = this.readManifest();
  }

  /**
   * Returns the script and styles a page links, by its entry name in `apps/public/vite.config.ts`.
   *
   * @throws {Error} If the service isn't started or the build has no such entry.
   */
  public getPage(name: string): PublicPageAssets {
    if (this.rereadManifest) this.entries = this.readManifest();
    const assets = this.entries?.get(name);
    if (!assets) {
      throw new Error(`The public pages' build has no "${name}" entry`);
    }
    return assets;
  }

  /** Returns the routes of the files, to mount at {@link PublicAssetsService.Path} under the base path. */
  public getApp(): Hono<HttpEnv> {
    return this.app;
  }

  protected createApp(): Hono<HttpEnv> {
    const app = new Hono<HttpEnv>({ strict: false });

    app.get('*', this.serveFiles(), (c) => {
      c.header('Cache-Control', 'no-store');
      return c.notFound();
    });

    return app;
  }

  protected readManifest(): ReadonlyMap<string, PublicPageAssets> {
    const path = join(this.directory, PublicAssetsService.ManifestPath);

    let manifest: Record<string, ManifestEntry>;
    try {
      manifest = JSON.parse(readFileSync(path, 'utf8')) as Record<
        string,
        ManifestEntry
      >;
    } catch (error) {
      throw new StartupError(
        `Couldn't read the public pages' files at ${path}, build apps/public first`,
        { cause: error },
      );
    }

    const entries = new Map<string, PublicPageAssets>();
    for (const entry of Object.values(manifest)) {
      if (!entry.isEntry || !entry.name) continue;

      entries.set(entry.name, {
        script: this.url(entry.file),
        styles: (entry.css ?? []).map((file) => this.url(file)),
      });
    }
    return entries;
  }

  // the manifest and anything outside the served folders stay private
  protected serveFiles(): MiddlewareHandler<HttpEnv> {
    const files = serveStatic<HttpEnv>({
      root: this.directory,
      precompressed: true,
      rewriteRequestPath: (path) => this.filePath(path),
    });

    return async (c, next) => {
      if (!this.isServed(c)) return next();

      // set before serving: serveStatic builds the response before its onFound runs
      c.header('Cache-Control', PublicAssetsService.ImmutableCacheControl);
      return files(c, next);
    };
  }

  protected isServed(c: Context<HttpEnv>): boolean {
    const file = this.filePath(c.req.path);
    return PublicAssetsService.ServedFolders.some((folder) =>
      file.startsWith(folder),
    );
  }

  protected filePath(path: string): string {
    return path.slice(this.siteUrl.path(PublicAssetsService.Path).length);
  }

  protected url(file: string): string {
    return this.siteUrl.path(`${PublicAssetsService.Path}/${file}`);
  }
}
