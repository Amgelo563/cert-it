import { readFile } from 'node:fs/promises';
import type { SiteUrl } from '@cert-it/hono';
import type { JobHandler, JobContext } from '@cert-it/jobs';
import {
  CourseDateFormatter,
  CourseFieldTypeEnum,
  type TemplateContent,
  type TemplateFieldValues,
  type TemplateValues,
  toTemplateFieldValues,
} from '@cert-it/shared';
import { PDFDocument } from '@pdfme/pdf-lib';
import type { Result } from 'better-result';
import type { Course } from '../../course/Course';
import type { CredentialSigner } from '../../credential/CredentialSigner';
import type { DatabaseService } from '../../database/DatabaseService';
import type { Job } from '../../job/Job';
import type { Participant } from '../../participant/Participant';
import type { DataDirectoryService } from '../../storage/DataDirectoryService';
import type { TemplateVersion } from '../../template/TemplateVersion';
import type { CertificateCode } from '../code/CertificateCode';
import { imageMediaTypeOf } from '../../field/image/ImageExtension';
import { CertificateRenderer } from '../render/CertificateRenderer';
import type { CertificateJobOutput } from './CertificateJobOutput';
import type { SkippedParticipant } from './SkippedParticipant';

export type CertificateJobHandlerOptions = {
  database: DatabaseService;
  dataDirectory: DataDirectoryService;
  /** Builds the public page URL that QR codes point to. */
  siteUrl: SiteUrl;
  /** Signs the credential each PDF carries as an attachment. */
  credentials: CredentialSigner;
};

/** A certificate to render, once its participant and values are known. */
export type CertificateToRender = {
  /** Its status list index, or null before the certificate is stored, which leaves its PDF without a credential. */
  readonly statusIndex: number | null;
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
  protected static readonly CredentialAttachment = {
    mimeType: 'application/jwt',
    description: 'Open Badges 3.0 verifiable credential',
  };

  protected readonly database: DatabaseService;

  protected readonly dataDirectory: DataDirectoryService;

  protected readonly siteUrl: SiteUrl;

  protected readonly credentials: CredentialSigner;

  constructor(options: CertificateJobHandlerOptions) {
    this.database = options.database;
    this.dataDirectory = options.dataDirectory;
    this.siteUrl = options.siteUrl;
    this.credentials = options.credentials;
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
    const inputs = renderer.inputsOf(
      this.valuesOf(course, certificate),
      await this.fieldValuesOf(renderer, course, certificate.participant),
    );
    const missing = renderer.findMissing(inputs);
    if (missing.length > 0) {
      const { participant } = certificate;
      return { participantId: participant.id, name: participant.name, missing };
    }

    const rendered = await renderer.render(inputs);
    const pdf =
      certificate.statusIndex === null
        ? rendered
        : await this.attachCredential(rendered, course, {
            ...certificate,
            statusIndex: certificate.statusIndex,
          });
    await this.dataDirectory.writeFile(
      this.dataDirectory.getCertificatePath(course.id, certificate.code),
      pdf,
    );
    return null;
  }

  /**
   * Adds the credential to a stored PDF, once its certificate has a status index.
   *
   * @throws {Error} If the PDF can't be read, parsed or written.
   */
  protected async storeCredential(
    course: Course,
    certificate: CertificateToRender & { readonly statusIndex: number },
  ): Promise<void> {
    const path = this.dataDirectory.getCertificatePath(
      course.id,
      certificate.code,
    );
    const pdf = await this.attachCredential(
      await readFile(path),
      course,
      certificate,
    );
    await this.dataDirectory.writeFile(path, pdf);
  }

  // as an embedded file, so the PDF carries its own proof
  protected async attachCredential(
    pdf: Uint8Array,
    course: Course,
    certificate: CertificateToRender & { readonly statusIndex: number },
  ): Promise<Uint8Array> {
    const jwt = this.credentials.signCertificate({
      certificate,
      course,
      participant: certificate.participant,
    });
    const document = await PDFDocument.load(pdf, { updateMetadata: false });
    await document.attach(
      new TextEncoder().encode(jwt),
      `${certificate.code}.jwt`,
      AbstractCertificateJobHandler.CredentialAttachment,
    );
    return document.save();
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

  // only the fields the template prints, reading each of their images
  protected async fieldValuesOf(
    renderer: CertificateRenderer,
    course: Course,
    participant: Participant,
  ): Promise<TemplateFieldValues> {
    const printed = renderer.getCourseFieldIds();
    if (printed.size === 0) return {};

    const fields = this.database
      .getRepositories()
      .courseFields.listByCourse(course.id)
      .filter((field) => printed.has(field.id));
    const images = new Map<string, string>();
    for (const field of fields) {
      const value = participant.fieldValues[String(field.id)];
      if (
        field.type !== CourseFieldTypeEnum.Image
        || typeof value !== 'string'
      ) {
        continue;
      }
      const url = await this.readImage(course, value);
      if (url) images.set(value, url);
    }

    return toTemplateFieldValues(fields, participant.fieldValues, {
      locale: course.locale,
      dateFormat: course.dateFormat,
      imageUrl: (fileName) => images.get(fileName),
    });
  }

  // a missing image prints nothing, as an empty value does
  protected async readImage(
    course: Course,
    fileName: string,
  ): Promise<string | null> {
    try {
      const bytes = await readFile(
        this.dataDirectory.getImagePath(course.id, fileName),
      );
      return `data:${imageMediaTypeOf(fileName)};base64,${bytes.toString('base64')}`;
    } catch {
      return null;
    }
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
