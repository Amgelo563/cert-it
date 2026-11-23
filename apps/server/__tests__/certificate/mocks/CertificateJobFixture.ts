import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SiteUrl } from '@cert-it/hono';
import { PDFDocument } from '@pdfme/pdf-lib';
import { type JobId, JobStatusEnum } from '@cert-it/jobs';
import {
  FontSourceEnum,
  type TemplateContent,
  TemplateFieldTypeEnum,
} from '@cert-it/shared';
import type { CertificateJobHandlerOptions } from '../../../src/certificate/issue/AbstractCertificateJobHandler';
import type { Course } from '../../../src/course/Course';
import type { DatabaseService } from '../../../src/database/DatabaseService';
import type { Job } from '../../../src/job/Job';
import type { JobTask } from '../../../src/job/JobTask';
import { DataDirectoryService } from '../../../src/storage/DataDirectoryService';
import type { TemplateVersion } from '../../../src/template/TemplateVersion';
import type { User } from '../../../src/user/User';
import { createTestDatabase } from '../../database/mocks/createTestDatabase';
import { MockSeeder } from '../../database/mocks/MockSeeder';
import { readFontFixture } from '../../font/mocks/readFontFixture';
import { createTestCredentials } from '../../credential/mocks/createTestCredentials';

/** A database and data directory with a course, an editor and a stored font, for the certificate job handlers. */
export class CertificateJobFixture {
  public static readonly BaseUrl = 'https://certs.example.org';

  public readonly database: DatabaseService;

  public readonly dataDirectory: DataDirectoryService;

  public readonly seed: MockSeeder;

  public readonly course: Course;

  public readonly editor: User;

  /** SHA-256 of the stored font, which covers printable ASCII plus `é`. */
  public readonly fontSha256: string;

  protected jobIds = 0;

  constructor() {
    this.database = createTestDatabase();
    this.dataDirectory = new DataDirectoryService({
      root: mkdtempSync(join(tmpdir(), 'cert-it-jobs-')),
    });
    this.dataDirectory.start();
    this.seed = new MockSeeder(this.database.getRepositories());
    this.course = this.seed.course();
    this.editor = this.seed.user();
    this.fontSha256 = this.storeFont();
  }

  /** Returns the options every handler takes. */
  public handlerOptions(): CertificateJobHandlerOptions {
    const siteUrl = new SiteUrl({ baseUrl: CertificateJobFixture.BaseUrl });
    return {
      database: this.database,
      dataDirectory: this.dataDirectory,
      siteUrl,
      credentials: createTestCredentials(this.database, siteUrl).signer,
    };
  }

  /** Saves a template version with a name, a date and a QR field, on a blank base PDF. */
  public async templateVersion(
    nameY = 50,
    fontName = this.fontSha256,
  ): Promise<TemplateVersion> {
    const { templateVersions } = this.database.getRepositories();
    const pdf = await this.basePdf();
    const sha256 = createHash('sha256').update(pdf).digest('hex');
    const basePdfPath = this.dataDirectory.getTemplateFile(
      this.course.id,
      sha256,
    );
    await this.dataDirectory.writeFile(basePdfPath, pdf);

    const version =
      (templateVersions.findLatest(this.course.id)?.version ?? 0) + 1;
    return templateVersions
      .create({
        courseId: this.course.id,
        version,
        template: this.template(nameY, fontName),
        basePdfPath,
        createdBy: this.editor.id,
      })
      .unwrap();
  }

  /** Returns a running job of the course, as the worker receives it. */
  public job<Task extends JobTask>(task: Task): Job & Task {
    this.jobIds += 1;
    return {
      ...task,
      id: this.jobIds as JobId,
      status: JobStatusEnum.Running,
      progress: 0,
      total: null,
      output: null,
      error: null,
      createdAt: new Date(),
      startedAt: new Date(),
      finishedAt: null,
      courseId: this.course.id,
      createdBy: this.editor.id,
    } as unknown as Job & Task;
  }

  /** Closes the database and removes the data directory. */
  public close(): void {
    this.database.close();
    rmSync(this.dataDirectory.getRoot(), { recursive: true, force: true });
  }

  protected template(nameY: number, fontName: string): TemplateContent {
    const text = {
      width: 150,
      height: 12,
      fontName,
      fontSize: 14,
      alignment: 'center',
      verticalAlignment: 'middle',
      lineHeight: 1,
      characterSpacing: 0,
      fontColor: '#000000',
      backgroundColor: '',
    };

    return {
      schemas: [
        [
          {
            ...text,
            name: 'Name',
            type: TemplateFieldTypeEnum.ParticipantName,
            position: { x: 20, y: nameY },
          },
          {
            ...text,
            name: 'Date',
            type: TemplateFieldTypeEnum.IssueDate,
            position: { x: 20, y: 100 },
          },
          {
            name: 'QR',
            type: TemplateFieldTypeEnum.QrCode,
            position: { x: 20, y: 150 },
            width: 30,
            height: 30,
            backgroundColor: '#ffffff',
            barColor: '#000000',
          },
        ],
      ],
    };
  }

  // pdfme can't embed a page without content, as a blank page is
  protected async basePdf(): Promise<Uint8Array> {
    const document = await PDFDocument.create();
    document
      .addPage([842, 595])
      .drawRectangle({ x: 20, y: 20, width: 802, height: 555, borderWidth: 2 });
    return document.save();
  }

  protected storeFont(): string {
    const bytes = readFontFixture('basic.ttf');
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const font = this.database
      .getRepositories()
      .fonts.create({
        sha256,
        family: 'Basic',
        style: 'Regular',
        source: FontSourceEnum.Upload,
        fileName: `${sha256}.ttf`,
      })
      .unwrap();
    writeFileSync(this.dataDirectory.getFontPath(font.fileName), bytes);

    return sha256;
  }
}
