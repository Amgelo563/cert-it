import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import type { SiteUrl } from '@cert-it/hono';
import { type Context, Hono } from 'hono';
import type { Config } from '../../config/schema/ConfigSchema';
import { StartupError } from '../../error/StartupError';
import type { HttpEnv } from '../../http/HttpEnv';
import { MessageCatalog } from '../../i18n/MessageCatalog';
import type { DataDirectoryService } from '../../storage/DataDirectoryService';
import type { LinkPreview, LinkPreviewImage } from './LinkPreview';

type LinkPreviewServiceOptions = {
  siteUrl: SiteUrl;
  dataDirectory: DataDirectoryService;
  messages: MessageCatalog;
  siteName: string;
  /** Replaces the certificate pages' titles, with their placeholders. */
  title?: string | undefined;
  /** Replaces the certificate pages' descriptions, with their placeholders. */
  description?: string | undefined;
  /** An https URL, or a file in the data directory given relative to it. */
  image?: string | undefined;
  imageAlt?: string | undefined;
  largeImage: boolean;
  themeColor: string;
};

type LoadedImage = {
  /** File name it's served under: its hash and extension. */
  fileName: string;
  type: string;
  content: Uint8Array<ArrayBuffer>;
};

/** Builds the link previews of the public pages from the config, and serves a local preview image under `{base_path}/link-preview/`. */
export class LinkPreviewService {
  /** Path the local image is served under, relative to the base path. */
  public static readonly Path = '/link-preview';

  protected static readonly ImageTypes: Readonly<Record<string, string>> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
  };

  // named by its hash, so a replaced image gets a new URL
  protected static readonly ImmutableCacheControl =
    'public, max-age=31536000, immutable';

  protected static readonly HashLength = 16;

  protected readonly siteUrl: SiteUrl;

  protected readonly dataDirectory: DataDirectoryService;

  protected readonly messages: MessageCatalog;

  protected readonly siteName: string;

  protected readonly title: string | null;

  protected readonly description: string | null;

  protected readonly image: string | null;

  protected readonly imageAlt: string | null;

  protected readonly largeImage: boolean;

  protected readonly themeColor: string;

  protected readonly app: Hono<HttpEnv>;

  /** The local image, read at start. */
  protected localImage: LoadedImage | null = null;

  constructor(options: LinkPreviewServiceOptions) {
    this.siteUrl = options.siteUrl;
    this.dataDirectory = options.dataDirectory;
    this.messages = options.messages;
    this.siteName = options.siteName;
    this.title = options.title ?? null;
    this.description = options.description ?? null;
    this.image = options.image ?? null;
    this.imageAlt = options.imageAlt ?? null;
    this.largeImage = options.largeImage;
    this.themeColor = options.themeColor;
    this.app = this.createApp();
  }

  public static create(options: {
    config: Pick<Config, 'linkPreviews' | 'site'>;
    siteUrl: SiteUrl;
    dataDirectory: DataDirectoryService;
    injections?: Partial<Omit<LinkPreviewServiceOptions, 'dataDirectory'>>;
  }): LinkPreviewService {
    const { config, siteUrl, dataDirectory, injections } = options;
    const previews = config.linkPreviews;

    return new LinkPreviewService({
      siteUrl,
      dataDirectory,
      messages: injections?.messages ?? new MessageCatalog(),
      siteName:
        injections?.siteName ?? previews.siteName ?? config.site.orgName,
      title: injections?.title ?? previews.title,
      description: injections?.description ?? previews.description,
      image: injections?.image ?? previews.image,
      imageAlt: injections?.imageAlt ?? previews.imageAlt,
      largeImage: injections?.largeImage ?? previews.largeImage,
      themeColor: injections?.themeColor ?? previews.themeColor,
    });
  }

  /**
   * Reads the local image, when the image is a file.
   *
   * @throws {StartupError} If the file can't be read, or is outside the data directory.
   */
  public start(): void {
    if (!this.image || this.isRemote(this.image)) return;

    let content: Buffer;
    try {
      content = readFileSync(this.dataDirectory.resolve(this.image));
    } catch (error) {
      throw new StartupError(
        `Couldn't read the link preview image ${this.image}`,
        { cause: error },
      );
    }

    const extension = extname(this.image).toLowerCase();
    const hash = createHash('sha256')
      .update(content)
      .digest('hex')
      .slice(0, LinkPreviewService.HashLength);
    this.localImage = {
      fileName: `${hash}${extension}`,
      type:
        LinkPreviewService.ImageTypes[extension] ?? 'application/octet-stream',
      content: new Uint8Array(content),
    };
  }

  /** Returns the route of the local image, to mount under the base path. */
  public getApp(): Hono<HttpEnv> {
    return this.app;
  }

  /** Returns the preview of a page with its own title and description. */
  public getPreview(options: {
    /** Path of the page, relative to the base path. */
    path: string;
    title: string;
    description: string;
  }): LinkPreview {
    return {
      url: this.siteUrl.url(options.path),
      siteName: this.siteName,
      title: options.title,
      description: options.description,
      image: this.getImage(),
      largeImage: this.largeImage,
      themeColor: this.themeColor,
    };
  }

  /** Returns the preview of a certificate page, with the configured title and description in place of the page's own. */
  public getCertificatePreview(options: {
    path: string;
    title: string;
    description: string;
    /** Values of the configured texts' placeholders. */
    values: Record<string, string>;
  }): LinkPreview {
    const { values } = options;

    return this.getPreview({
      path: options.path,
      title: this.title
        ? this.messages.format(this.title, values)
        : options.title,
      description: this.description
        ? this.messages.format(this.description, values)
        : options.description,
    });
  }

  protected createApp(): Hono<HttpEnv> {
    const app = new Hono<HttpEnv>({ strict: false });
    app.get(`${LinkPreviewService.Path}/:file`, (c) => this.serveImage(c));
    return app;
  }

  protected serveImage(c: Context<HttpEnv>): Response | Promise<Response> {
    const image = this.localImage;
    if (!image || c.req.param('file') !== image.fileName) {
      c.header('Cache-Control', 'no-store');
      return c.notFound();
    }

    c.header('Content-Type', image.type);
    c.header('Cache-Control', LinkPreviewService.ImmutableCacheControl);
    return c.body(image.content);
  }

  protected getImage(): LinkPreviewImage | null {
    if (!this.image) return null;

    const alt = this.imageAlt;
    if (this.isRemote(this.image)) {
      const extension = extname(new URL(this.image).pathname).toLowerCase();
      return {
        url: this.image,
        type: LinkPreviewService.ImageTypes[extension] ?? null,
        alt,
      };
    }

    const image = this.localImage;
    if (!image) return null;

    return {
      url: this.siteUrl.url(`${LinkPreviewService.Path}/${image.fileName}`),
      type: image.type,
      alt,
    };
  }

  protected isRemote(image: string): boolean {
    return image.startsWith('https://');
  }
}
