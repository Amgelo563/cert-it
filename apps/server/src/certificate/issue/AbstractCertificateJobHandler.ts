import { readFile } from 'node:fs/promises';
import type { SiteUrl } from '@cert-it/hono';
import type { JobHandler, JobContext } from '@cert-it/jobs';
import {
  CourseDateFormatter,
  type TemplateContent,
  type TemplateValues,
} from '@cert-it/shared';
import type { Result } from 'better-result';
import type { Course } from '../../course/Course';
import type { DatabaseService } from '../../database/DatabaseService';
import type { Job } from '../../job/Job';
import type { Participant } from '../../participant/Participant';
import type { DataDirectoryService } from '../../storage/DataDirectoryService';
import type { TemplateVersion } from '../../template/TemplateVersion';
import type { CertificateCode } from '../code/CertificateCode';
import { CertificateRenderer } from '../render/CertificateRenderer';
import type { CertificateJobOutput } from './CertificateJobOutput';
import type { SkippedParticipant } from './SkippedParticipant';

export type CertificateJobHandlerOptions = {
  database: DatabaseService;
  dataDirectory: DataDirectoryService;
  /** Builds the public page URL that QR codes point to. */
  siteUrl: SiteUrl;
};

/** A certificate to render, once its participant and values are known. */
export type CertificateToRender = {
  readonly participant: Participant;
  readonly code: CertificateCode;
  /** The date to print, as `YYYY-MM-DD`. */
  readonly issueDate: string;
};

/** A job handler that renders certificates with a template version, in the generator process. */
export abstract class AbstractCertificateJobHandler<
  J extends Job,
  E extends Error,
> implements JobHandler<J, CertificateJobOutput, E> {
  protected readonly database: DatabaseService;

  protected readonly dataDirectory: DataDirectoryService;

  protected readonly siteUrl: SiteUrl;

  constructor(options: CertificateJobHandlerOptions) {
    this.database = options.database;
    this.dataDirectory = options.dataDirectory;
    this.siteUrl = options.siteUrl;
  }

  public abstract run(
    job: J,
    context: JobContext,
  ): Promise<Result<CertificateJobOutput, E>>;

  /**
   * Loads the base PDF and fonts of a template version.
   *
   * @throws {Error} If a file is missing or a font can't be parsed.
   */
  protected async loadRenderer(
    version: TemplateVersion,
  ): Promise<CertificateRenderer> {
    const basePdf = await readFile(
      this.dataDirectory.resolve(version.basePdfPath),
    );

    return CertificateRenderer.load(
      version.template as TemplateContent,
      new Uint8Array(basePdf),
      { readFont: (sha256) => this.readFont(sha256) },
    );
  }

  /**
   * Renders a certificate and stores its PDF, replacing any earlier one, unless the template's fonts can't draw its values.
   *
   * @returns The participant when the certificate was skipped, or null when its PDF was stored.
   */
  protected async renderAndStore(
    renderer: CertificateRenderer,
    course: Course,
    certificate: CertificateToRender,
  ): Promise<SkippedParticipant | null> {
    const values = this.valuesOf(course, certificate);
    const missing = renderer.findMissing(values);
    if (missing.length > 0) {
      const { participant } = certificate;
      return { participantId: participant.id, name: participant.name, missing };
    }

    const pdf = await renderer.render(values);
    await this.dataDirectory.writeFile(
      this.dataDirectory.getCertificatePath(course.id, certificate.code),
      pdf,
    );
    return null;
  }

  protected valuesOf(
    course: Course,
    certificate: CertificateToRender,
  ): TemplateValues {
    return {
      participantName: certificate.participant.name,
      issueDate: new CourseDateFormatter(course).format(certificate.issueDate),
      qrcode: this.siteUrl.url(`/c/${encodeURIComponent(certificate.code)}`),
    };
  }

  // only fonts the server checked and stored are referenced by templates
  protected async readFont(sha256: string): Promise<Uint8Array<ArrayBuffer>> {
    const font = this.database.getRepositories().fonts.findBySha256(sha256);
    if (!font) throw new Error(`The font ${sha256} isn't stored.`);

    return new Uint8Array(
      await readFile(this.dataDirectory.getFontPath(font.fileName)),
    );
  }
}
