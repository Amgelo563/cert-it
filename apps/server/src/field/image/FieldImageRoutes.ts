import { createHash } from 'node:crypto';
import { access } from 'node:fs/promises';
import { FileStreamer } from '@cert-it/hono';
import {
  type ApiErrorCode,
  ApiErrorCodeEnum,
  FileSystemError,
  type ImageUpload,
  isImageFileName,
  MaxImageBytes,
  PermissionEnum,
} from '@cert-it/shared';
import { type Context, Hono } from 'hono';
import type { ClientErrorStatusCode } from 'hono/utils/http-status';
import type { AuthGuard } from '../../auth/AuthGuard';
import type { CourseEnv } from '../../course/CourseEnv';
import { CourseLoader } from '../../course/CourseLoader';
import type { DatabaseService } from '../../database/DatabaseService';
import { FontRoutes } from '../../font/FontRoutes';
import { AbstractApiRoutes } from '../../http/api/AbstractApiRoutes';
import { UploadReader } from '../../http/upload/UploadReader';
import type { DataDirectoryService } from '../../storage/DataDirectoryService';
import { imageExtensionOf, imageMediaTypeOf } from './ImageExtension';

type FieldImageRoutesOptions = {
  dataDirectory: DataDirectoryService;
  guard: AuthGuard;
  courseLoader: CourseLoader;
  uploads: UploadReader;
};

/** Serves the images of a course's image fields: anyone can see them, Editors upload them. Images are stored by their hash, so the same file is stored once. */
export class FieldImageRoutes extends AbstractApiRoutes {
  /** Path of the routes, relative to the base path. */
  public static readonly Path = '/api/courses/:courseId/images';

  protected static override readonly ErrorStatuses: Partial<
    Record<ApiErrorCode, ClientErrorStatusCode>
  > = {
    [ApiErrorCodeEnum.NotFound]: 404,
    [ApiErrorCodeEnum.FileTooLarge]: 413,
  };

  protected readonly dataDirectory: DataDirectoryService;

  protected readonly guard: AuthGuard;

  protected readonly courseLoader: CourseLoader;

  protected readonly uploads: UploadReader;

  protected readonly app: ReturnType<FieldImageRoutes['createApp']>;

  constructor(options: FieldImageRoutesOptions) {
    super();
    this.dataDirectory = options.dataDirectory;
    this.guard = options.guard;
    this.courseLoader = options.courseLoader;
    this.uploads = options.uploads;
    this.app = this.createApp();
  }

  public static create(options: {
    database: DatabaseService;
    dataDirectory: DataDirectoryService;
    guard: AuthGuard;
    injections?: Partial<
      Pick<FieldImageRoutesOptions, 'uploads' | 'courseLoader'>
    >;
  }): FieldImageRoutes {
    const { database, injections, ...shared } = options;

    return new FieldImageRoutes({
      ...shared,
      courseLoader:
        injections?.courseLoader ?? CourseLoader.create({ database }),
      uploads:
        injections?.uploads ?? new UploadReader({ maxBytes: MaxImageBytes }),
    });
  }

  /** Returns the routes, to mount at {@link FieldImageRoutes.Path}. */
  public getApp(): FieldImageRoutes['app'] {
    return this.app;
  }

  // chained, so hono/client can infer the routes' types
  protected createApp() {
    const { guard } = this;

    return new Hono<CourseEnv>({ strict: false })
      .use(guard.authenticate())
      .post(
        '/',
        guard.requirePermission(PermissionEnum.EditParticipants),
        this.courseLoader.middleware(),
        (c) => this.upload(c),
      )
      .get(
        '/:fileName',
        guard.requirePermission(PermissionEnum.ViewRecords),
        this.courseLoader.middleware(),
        (c) => this.download(c),
      );
  }

  // small enough to read whole, then checked by its first bytes
  protected async upload(c: Context<CourseEnv>) {
    const course = c.get('course');

    const read = await this.uploads.readBytes(c.req.raw);
    if (read.isErr()) return this.error(c, ApiErrorCodeEnum.FileTooLarge);

    const bytes = read.value;
    const extension = imageExtensionOf(bytes);
    if (!extension) return this.error(c, ApiErrorCodeEnum.InvalidImage);

    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const fileName = `${sha256}.${extension}`;
    const path = this.dataDirectory.getImageFile(course.id, fileName);
    if (!(await this.exists(path))) {
      await this.dataDirectory.writeFile(path, bytes);
    }
    return c.json<ImageUpload, 201>({ image: fileName }, 201);
  }

  protected async download(c: Context<CourseEnv>) {
    const course = c.get('course');
    const fileName = c.req.param('fileName');
    if (!fileName || !isImageFileName(fileName)) {
      return this.error(c, ApiErrorCodeEnum.NotFound);
    }

    const sent = await FileStreamer.Instance.send(
      c,
      this.dataDirectory.getImagePath(course.id, fileName),
      {
        'Content-Type': imageMediaTypeOf(fileName),
        'Cache-Control': FontRoutes.ImmutableCacheControl,
      },
    );
    if (sent.isOk()) return sent.value;
    if (FileSystemError.is(sent.error)) throw sent.error.cause;
    return this.error(c, ApiErrorCodeEnum.NotFound);
  }

  protected async exists(path: string): Promise<boolean> {
    try {
      await access(this.dataDirectory.resolve(path));
      return true;
    } catch {
      return false;
    }
  }
}
