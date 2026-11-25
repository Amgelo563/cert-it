import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import type { SiteUrl } from '@cert-it/hono';
import {
  type AdminBranding,
  createBrandShades,
  ThemeValues,
} from '@cert-it/shared';
import { type Context, Hono } from 'hono';
import type { Config } from '../config/schema/ConfigSchema';
import { StartupError } from '../error/StartupError';
import type { HttpEnv } from '../http/HttpEnv';
import type { DataDirectoryService } from '../storage/DataDirectoryService';
import type { PublicBranding } from './PublicBranding';

type BrandingServiceOptions = {
  siteUrl: SiteUrl;
  dataDirectory: DataDirectoryService;
  /** Name of the admin panel. */
  name: string;
  /** Main brand color, as a hex color. */
  primaryColor: string;
  /** Files in the data directory, given relative to it. */
  logo?: string | undefined;
  logoDark?: string | undefined;
  favicon?: string | undefined;
  font?: string | undefined;
  lookupImage?: string | undefined;
  /** URL of the favicon when none is configured. */
  defaultFavicon: string;
};

type LoadedFile = {
  /** File name it's served under: its hash and extension. */
  fileName: string;
  type: string;
  content: Uint8Array<ArrayBuffer>;
};

type BrandingFiles = {
  logo: LoadedFile | null;
  logoDark: LoadedFile | null;
  favicon: LoadedFile | null;
  font: LoadedFile | null;
  lookupImage: LoadedFile | null;
  stylesheet: LoadedFile | null;
};

/** Brands the public pages and the admin panel from the config: name, colors, font and images, served under `{base_path}/branding/`. */
export class BrandingService {
  /** Path the files are served under, relative to the base path. */
  public static readonly Path = '/branding';

  // the brand font's family name in the stylesheet
  protected static readonly FontFamily = 'cert-it brand';

  protected static readonly Types: Readonly<Record<string, string>> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff2': 'font/woff2',
    '.woff': 'font/woff',
    '.ttf': 'font/ttf',
    '.otf': 'font/otf',
    '.css': 'text/css; charset=utf-8',
  };

  protected static readonly FontFormats: Readonly<Record<string, string>> = {
    '.woff2': 'woff2',
    '.woff': 'woff',
    '.ttf': 'truetype',
    '.otf': 'opentype',
  };

  // named by their hash, so a replaced file gets a new URL
  protected static readonly ImmutableCacheControl =
    'public, max-age=31536000, immutable';

  protected static readonly HashLength = 16;

  protected readonly siteUrl: SiteUrl;

  protected readonly dataDirectory: DataDirectoryService;

  protected readonly name: string;

  protected readonly brandShades: readonly string[];

  protected readonly sources: Pick<
    BrandingServiceOptions,
    'logo' | 'logoDark' | 'favicon' | 'font' | 'lookupImage'
  >;

  protected readonly defaultFavicon: string;

  protected readonly app: Hono<HttpEnv>;

  /** The configured files and the stylesheet, read and built at start. */
  protected files: BrandingFiles | null = null;

  constructor(options: BrandingServiceOptions) {
    this.siteUrl = options.siteUrl;
    this.dataDirectory = options.dataDirectory;
    this.name = options.name;
    this.brandShades = createBrandShades(options.primaryColor);
    this.sources = {
      logo: options.logo,
      logoDark: options.logoDark,
      favicon: options.favicon,
      font: options.font,
      lookupImage: options.lookupImage,
    };
    this.defaultFavicon = options.defaultFavicon;
    this.app = this.createApp();
  }

  public static create(options: {
    config: Pick<Config, 'branding'>;
    siteUrl: SiteUrl;
    dataDirectory: DataDirectoryService;
    /** URL of the built-in favicon. */
    defaultFavicon: string;
    injections?: Partial<
      Omit<BrandingServiceOptions, 'siteUrl' | 'dataDirectory'>
    >;
  }): BrandingService {
    const { config, siteUrl, dataDirectory, defaultFavicon, injections } =
      options;
    const { branding } = config;

    return new BrandingService({
      siteUrl,
      dataDirectory,
      name: injections?.name ?? branding.name,
      primaryColor: injections?.primaryColor ?? branding.primaryColor,
      logo: injections?.logo ?? branding.logo,
      logoDark: injections?.logoDark ?? branding.logoDark,
      favicon: injections?.favicon ?? branding.favicon,
      font: injections?.font ?? branding.font,
      lookupImage: injections?.lookupImage ?? branding.lookupImage,
      defaultFavicon: injections?.defaultFavicon ?? defaultFavicon,
    });
  }

  /**
   * Reads the configured files and builds the stylesheet.
   *
   * @throws {StartupError} If a file can't be read, or is outside the data directory.
   */
  public start(): void {
    const font = this.load(this.sources.font, 'font');

    this.files = {
      logo: this.load(this.sources.logo, 'logo'),
      logoDark: this.load(this.sources.logoDark, 'dark logo'),
      favicon: this.load(this.sources.favicon, 'favicon'),
      font,
      lookupImage: this.load(this.sources.lookupImage, 'lookup image'),
      stylesheet: this.buildStylesheet(font),
    };
  }

  /** Returns the routes of the files, to mount under the base path. */
  public getApp(): Hono<HttpEnv> {
    return this.app;
  }

  /**
   * Returns what the public pages link and show.
   *
   * @throws {Error} If the service isn't started.
   */
  public getPublicBranding(): PublicBranding {
    const files = this.getFiles();

    return {
      stylesheet: this.url(files.stylesheet),
      favicon: files.favicon
        ? { url: this.url(files.favicon)!, type: files.favicon.type }
        : {
            url: this.defaultFavicon,
            type: BrandingService.Types['.svg']!,
          },
      logo: this.url(files.logo),
      logoDark: this.url(files.logoDark),
      lookupImage: this.url(files.lookupImage),
    };
  }

  /**
   * Returns what the admin panel reads from its page.
   *
   * @throws {Error} If the service isn't started.
   */
  public getAdminBranding(): AdminBranding {
    const files = this.getFiles();

    return {
      name: this.name,
      brandShades: this.brandShades,
      logo: this.url(files.logo),
      logoDark: this.url(files.logoDark),
      fontFamily: this.fontFamily(files.font),
    };
  }

  /** Returns the main brand color, as a hex color. */
  public getPrimaryColor(): string {
    return this.brandShades[ThemeValues.brandShadeIndex]!;
  }

  protected createApp(): Hono<HttpEnv> {
    const app = new Hono<HttpEnv>({ strict: false });
    app.get(`${BrandingService.Path}/:file`, (c) => this.serveFile(c));
    return app;
  }

  protected serveFile(c: Context<HttpEnv>): Response | Promise<Response> {
    const name = c.req.param('file');
    const file = Object.values(this.files ?? {}).find(
      (loaded: LoadedFile | null) => loaded?.fileName === name,
    );
    if (!file) {
      c.header('Cache-Control', 'no-store');
      return c.notFound();
    }

    c.header('Content-Type', file.type);
    c.header('Cache-Control', BrandingService.ImmutableCacheControl);
    return c.body(file.content);
  }

  protected getFiles(): BrandingFiles {
    if (!this.files) throw new Error('The branding service is not started');
    return this.files;
  }

  protected load(path: string | undefined, label: string): LoadedFile | null {
    if (!path) return null;

    let content: Buffer;
    try {
      content = readFileSync(this.dataDirectory.resolve(path));
    } catch (error) {
      throw new StartupError(`Couldn't read the branding ${label} ${path}`, {
        cause: error,
      });
    }

    return this.toFile(new Uint8Array(content), extname(path).toLowerCase());
  }

  protected toFile(
    content: Uint8Array<ArrayBuffer>,
    extension: string,
  ): LoadedFile {
    const hash = createHash('sha256')
      .update(content)
      .digest('hex')
      .slice(0, BrandingService.HashLength);

    return {
      fileName: `${hash}${extension}`,
      type: BrandingService.Types[extension] ?? 'application/octet-stream',
      content,
    };
  }

  // overrides the theme values the public pages were built with
  protected buildStylesheet(font: LoadedFile | null): LoadedFile | null {
    const variables: string[] = [];
    const rules: string[] = [];

    if (!this.hasDefaultColors()) {
      variables.push(
        ...this.brandShades.map((shade, i) => `--brand-${i}: ${shade};`),
      );
    }

    if (font) {
      const extension = extname(font.fileName);
      rules.push(
        [
          '@font-face {',
          `  font-family: '${BrandingService.FontFamily}';`,
          // relative to the stylesheet, which is served next to it
          `  src: url('${font.fileName}') format('${BrandingService.FontFormats[extension]}');`,
          '  font-weight: 100 900;',
          '  font-display: swap;',
          '}',
        ].join('\n'),
      );
      variables.push(`--font: ${this.fontFamily(font)};`);
    }

    if (variables.length === 0) return null;

    rules.push(`:root {\n  ${variables.join('\n  ')}\n}`);
    return this.toFile(
      new TextEncoder().encode(`${rules.join('\n\n')}\n`),
      '.css',
    );
  }

  protected hasDefaultColors(): boolean {
    return this.brandShades.every(
      (shade, i) => shade === ThemeValues.brandShades[i],
    );
  }

  protected fontFamily(font: LoadedFile | null): string {
    return font
      ? `'${BrandingService.FontFamily}', ${ThemeValues.fontFamily}`
      : ThemeValues.fontFamily;
  }

  protected url(file: LoadedFile | null): string | null {
    return file
      ? this.siteUrl.path(`${BrandingService.Path}/${file.fileName}`)
      : null;
  }
}
