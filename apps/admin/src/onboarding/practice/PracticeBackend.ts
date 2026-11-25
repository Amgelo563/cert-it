import {
  type ApiErrorCode,
  ApiErrorCodeEnum,
  type ApiPage,
  type BasePdfUpload,
  CertificateStatusEnum,
  CourseDateFormatter,
  type CourseFieldSummary,
  type CourseSummary,
  type CreateCourseFieldRequest,
  type CreatedUserResponse,
  type CreateCourseRequest,
  type CreateParticipantRequest,
  type CreateUserRequest,
  type CurrentUser,
  type FontSource,
  FontSourceEnum,
  type FontSummary,
  hasParticipantNameField,
  type ImportCatalogFontRequest,
  type ImportParticipantsRequest,
  type ImportParticipantsResponse,
  type ImportRowResult,
  ImportRowErrorEnum,
  ImportRowStatusEnum,
  ImportSkipReasonEnum,
  type IssueCertificatesRequest,
  type JobSummary,
  JobStatusEnum,
  JobTypeEnum,
  type Locale,
  type OutdatedCertificates,
  type ParticipantSummary,
  RoleEnum,
  type SaveTemplateRequest,
  type TemplateContent,
  type TemplateDetail,
  TemplateFieldTypeEnum,
  type UserSummary,
} from '@cert-it/shared';
import type { InvalidFontReason } from '@cert-it/fonts';
import { createSamplePdf, type SamplePdfTexts } from './createSamplePdf';
import { type PracticeEvent, PracticeEventEnum } from './PracticeEventEnum';

/** Texts of the sample data, in the panel's language. */
export type PracticeSampleTexts = {
  courseName: string;
  /** Name of the course whose template the template tour finishes. */
  draftCourseName: string;
  participantNames: readonly string[];
  teammateEmail: string;
  pdf: SamplePdfTexts;
  /** Names the Designer gives new fields, by type. */
  fieldNames: { participantName: string; issueDate: string; qrcode: string };
  /** What new fields show, by type. */
  fieldSamples: { participantName: string; qrcode: string };
};

type PracticeBackendOptions = {
  /** Sends what practice passes through, such as auth and font reads. */
  realFetch: typeof fetch;
  /** URL of the API routes, such as `https://example.org/certs/api/`. */
  apiUrl: URL;
  texts: PracticeSampleTexts;
  locale: Locale;
  currentUser: CurrentUser;
  now: () => Date;
};

type PracticeCourse = Omit<
  CourseSummary,
  | 'participantCount'
  | 'latestTemplateVersion'
  | 'latestTemplateHasName'
  | 'certificateCounts'
>;

// moves on as it is polled, so its fields change
type PracticeJob = { -readonly [Key in keyof JobSummary]: JobSummary[Key] } & {
  participantIds: readonly number[];
  issueDate: string;
  createdMs: number;
};

type Route = {
  method: string;
  pattern: RegExp;
  handle: (request: PracticeRequest) => Promise<Response> | Response;
};

type PracticeRequest = {
  params: string[];
  query: URLSearchParams;
  body: BodyInit | null | undefined;
};

type PracticeListener = (event: PracticeEvent) => void;

/** An in-memory copy of the API's course, participant, template, certificate and user routes, so tours can be followed without touching real records. */
export class PracticeBackend {
  /** How long a practice job takes to make its certificates. */
  protected static readonly JobDurationMs = 2500;

  // what's only read, or about the session, still goes to the server
  protected static readonly PassThrough: readonly RegExp[] = [
    /^auth\//,
    /^onboarding(\/|$)/,
  ];

  protected static readonly PassThroughReads: readonly RegExp[] = [
    /^fonts\/[0-9a-f]{64}(\/preview)?$/,
    /^font-catalog(\/preview)?$/,
  ];

  // the server's own answer for each reason a file isn't a usable font; typed only, so fontkit stays out of the main bundle
  protected static readonly InvalidFontCodes: Readonly<
    Record<InvalidFontReason, ApiErrorCode>
  > = {
    unreadable: ApiErrorCodeEnum.InvalidFont,
    collection: ApiErrorCodeEnum.FontCollection,
    web_format: ApiErrorCodeEnum.WebFont,
  };

  protected readonly realFetch: typeof fetch;

  protected readonly apiUrl: URL;

  protected readonly texts: PracticeSampleTexts;

  protected readonly locale: Locale;

  protected readonly currentUser: CurrentUser;

  protected readonly now: () => Date;

  protected readonly routes: readonly Route[];

  protected readonly listeners = new Set<PracticeListener>();

  protected readonly courses: PracticeCourse[] = [];

  protected readonly participants: ParticipantSummary[] = [];

  /** Fields added in practice, which keep no values. */
  protected readonly fields: CourseFieldSummary[] = [];

  protected readonly templates: TemplateDetail[] = [];

  protected readonly basePdfs = new Map<string, ArrayBuffer>();

  protected readonly jobs: PracticeJob[] = [];

  protected readonly users: UserSummary[] = [];

  /** Fonts uploaded or imported in practice, kept only here. */
  protected readonly fonts = new Map<
    string,
    { summary: FontSummary; bytes: ArrayBuffer }
  >();

  protected nextId = 1;

  protected sampleCourseId: number | null = null;

  protected draftCourseId: number | null = null;

  constructor(options: PracticeBackendOptions) {
    this.realFetch = options.realFetch;
    this.apiUrl = options.apiUrl;
    this.texts = options.texts;
    this.locale = options.locale;
    this.currentUser = options.currentUser;
    this.now = options.now;
    this.routes = this.createRoutes();
  }

  public static create(options: {
    texts: PracticeSampleTexts;
    locale: Locale;
    currentUser: CurrentUser;
    injections?: Partial<
      Pick<PracticeBackendOptions, 'realFetch' | 'apiUrl' | 'now'>
    >;
  }): PracticeBackend {
    return new PracticeBackend({
      ...options,
      realFetch:
        options.injections?.realFetch ?? globalThis.fetch.bind(globalThis),
      apiUrl:
        options.injections?.apiUrl ?? new URL('../api/', document.baseURI),
      now: options.injections?.now ?? (() => new Date()),
    });
  }

  /** Fills a sample course with participants and a full template, and a draft course whose template lacks the name; text fields use the first stored font if there's one. */
  public async start(): Promise<void> {
    const font = await this.findFirstFont();
    const pdf = createSamplePdf(this.texts.pdf);
    const sha256 = await PracticeBackend.sha256Of(pdf);
    this.basePdfs.set(sha256, pdf);

    const draft = this.addCourse({ name: this.texts.draftCourseName });
    this.draftCourseId = draft.id;
    // no font, so the tour can teach adding one
    this.addTemplate(draft.id, sha256, this.sampleTemplate(null, false), null);

    const course = this.addCourse({ name: this.texts.courseName });
    this.sampleCourseId = course.id;
    for (const [index, name] of this.texts.participantNames.entries()) {
      this.addParticipant(course.id, {
        name,
        email: `participant${index + 1}@example.org`,
      });
    }
    this.addTemplate(course.id, sha256, this.sampleTemplate(font, true), font);

    this.users.push(
      {
        id: this.currentUser.id,
        email: this.currentUser.email,
        role: this.currentUser.role,
        active: true,
        mustChangePassword: false,
        createdAt: this.timestamp(),
      },
      {
        id: this.id(),
        email: this.texts.teammateEmail,
        role: RoleEnum.Editor,
        active: true,
        mustChangePassword: false,
        createdAt: this.timestamp(),
      },
    );
  }

  /** Returns the ID of the sample course the tours use. */
  public getSampleCourseId(): number {
    if (this.sampleCourseId === null) {
      throw new Error('The practice backend has not started');
    }
    return this.sampleCourseId;
  }

  /** Returns the ID of the draft course, whose template lacks the participant name. */
  public getDraftCourseId(): number {
    if (this.draftCourseId === null) {
      throw new Error('The practice backend has not started');
    }
    return this.draftCourseId;
  }

  /** Adds a listener for what's done in practice, returning a function that removes it. */
  public onEvent(listener: PracticeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Answers a request as the API would, for the practice's API client. */
  public readonly fetch = async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const method = (
      init?.method ?? (input instanceof Request ? input.method : 'GET')
    ).toUpperCase();
    const start = url.pathname.lastIndexOf('/api/');
    const path = url.pathname.slice(start + '/api/'.length).replace(/\/$/, '');

    const practiceFont = this.fonts.get(
      /^fonts\/([0-9a-f]{64})/.exec(path)?.[1] ?? '',
    );
    if (practiceFont && method === 'GET') {
      return path.endsWith('/preview')
        ? this.previewFont(practiceFont)
        : new Response(practiceFont.bytes.slice(0), {
            headers: { 'Content-Type': 'application/octet-stream' },
          });
    }

    if (
      PracticeBackend.PassThrough.some((pattern) => pattern.test(path))
      || (method === 'GET'
        && PracticeBackend.PassThroughReads.some((pattern) =>
          pattern.test(path),
        ))
    ) {
      return this.realFetch(input, init);
    }

    for (const route of this.routes) {
      if (route.method !== method) continue;
      const match = route.pattern.exec(path);
      if (!match) continue;
      return route.handle({
        params: match.slice(1),
        query: url.searchParams,
        body: init?.body,
      });
    }
    return PracticeBackend.error(409, ApiErrorCodeEnum.UnavailableInPractice);
  };

  protected createRoutes(): Route[] {
    const id = '(\\d+)';
    const route = (
      method: string,
      path: string,
      handle: Route['handle'],
    ): Route => ({ method, pattern: new RegExp(`^${path}$`), handle });

    return [
      route('GET', 'courses', ({ query }) =>
        PracticeBackend.json(
          200,
          this.page(
            this.courses.toReversed().map((course) => this.summaryOf(course)),
            query,
          ),
        ),
      ),
      route('POST', 'courses', async ({ body }) => {
        const request = await PracticeBackend.read<CreateCourseRequest>(body);
        const course = this.addCourse(request);
        this.emit({
          type: PracticeEventEnum.CourseCreated,
          courseId: course.id,
        });
        return PracticeBackend.json(201, this.summaryOf(course));
      }),
      route('GET', `courses/${id}`, ({ params }) => {
        const course = this.findCourse(params[0]);
        return course
          ? PracticeBackend.json(200, this.summaryOf(course))
          : PracticeBackend.error(404, ApiErrorCodeEnum.NotFound);
      }),
      route('GET', `courses/${id}/fields`, ({ params }) =>
        PracticeBackend.json(
          200,
          this.fields.filter((field) => field.courseId === Number(params[0])),
        ),
      ),
      // the import can add fields; their values aren't kept
      route('POST', `courses/${id}/fields`, async ({ params, body }) => {
        const request =
          await PracticeBackend.read<CreateCourseFieldRequest>(body);
        const courseId = Number(params[0]);
        const field: CourseFieldSummary = {
          id: this.id(),
          courseId,
          label: request.label.trim(),
          type: request.type,
          required: false,
          position: this.fields.filter((f) => f.courseId === courseId).length,
          valueCount: 0,
        };
        this.fields.push(field);
        return PracticeBackend.json(201, field);
      }),
      route('GET', `courses/${id}/participants`, ({ params, query }) =>
        PracticeBackend.json(
          200,
          this.page(this.listParticipants(Number(params[0]), query), query),
        ),
      ),
      route('POST', `courses/${id}/participants`, async ({ params, body }) => {
        const courseId = Number(params[0]);
        const request =
          await PracticeBackend.read<CreateParticipantRequest>(body);
        if (this.hasEmail(courseId, request.email)) {
          return PracticeBackend.error(
            409,
            ApiErrorCodeEnum.ParticipantEmailTaken,
          );
        }
        const participant = this.addParticipant(courseId, request);
        this.emit({ type: PracticeEventEnum.ParticipantsAdded, courseId });
        return PracticeBackend.json(201, participant);
      }),
      route(
        'POST',
        `courses/${id}/participants/import`,
        async ({ params, body }) => {
          const request =
            await PracticeBackend.read<ImportParticipantsRequest>(body);
          return PracticeBackend.json(
            200,
            this.importParticipants(Number(params[0]), request),
          );
        },
      ),
      route('GET', `courses/${id}/template`, ({ params }) =>
        PracticeBackend.json(200, this.findTemplate(Number(params[0]))),
      ),
      route('POST', `courses/${id}/template`, async ({ params, body }) => {
        const courseId = Number(params[0]);
        const request = await PracticeBackend.read<SaveTemplateRequest>(body);
        if (!this.basePdfs.has(request.basePdf)) {
          return PracticeBackend.error(400, ApiErrorCodeEnum.UnknownBasePdf);
        }
        const fonts = this.findTemplate(courseId)?.fonts ?? [];
        const saved = this.addTemplate(
          courseId,
          request.basePdf,
          request.template,
          fonts[0] ?? null,
        );
        this.emit({
          type: PracticeEventEnum.TemplateSaved,
          courseId,
          hasName: hasParticipantNameField(request.template),
        });
        return PracticeBackend.json(201, saved);
      }),
      route('POST', `courses/${id}/template/base-pdf`, async ({ body }) => {
        const bytes = await new Response(body).arrayBuffer();
        const sha256 = await PracticeBackend.sha256Of(bytes);
        this.basePdfs.set(sha256, bytes);
        return PracticeBackend.json<BasePdfUpload>(201, {
          basePdf: sha256,
          bytes: bytes.byteLength,
          large: false,
        });
      }),
      route(
        'GET',
        `courses/${id}/template/base-pdf/([0-9a-f]{64})`,
        ({ params }) => {
          const bytes = this.basePdfs.get(params[1] ?? '');
          return bytes
            ? new Response(bytes.slice(0), {
                headers: { 'Content-Type': 'application/pdf' },
              })
            : PracticeBackend.error(404, ApiErrorCodeEnum.NotFound);
        },
      ),
      route('GET', `courses/${id}/certificates/outdated`, ({ params }) =>
        PracticeBackend.json<OutdatedCertificates>(200, {
          latestVersion: this.findTemplate(Number(params[0]))?.version ?? null,
          items: [],
        }),
      ),
      route(
        'POST',
        `courses/${id}/certificates/issue`,
        async ({ params, body }) => {
          const request =
            await PracticeBackend.read<IssueCertificatesRequest>(body);
          return this.issue(Number(params[0]), request);
        },
      ),
      route('GET', `courses/${id}/jobs`, ({ params, query }) =>
        PracticeBackend.json(
          200,
          this.page(
            this.jobs
              .filter((job) => job.courseId === Number(params[0]))
              .toReversed()
              .map((job) => this.advanceJob(job)),
            query,
          ),
        ),
      ),
      route('GET', `courses/${id}/jobs/${id}`, ({ params }) => {
        const job = this.jobs.find(
          (candidate) =>
            candidate.courseId === Number(params[0])
            && candidate.id === Number(params[1]),
        );
        return job
          ? PracticeBackend.json(200, this.advanceJob(job))
          : PracticeBackend.error(404, ApiErrorCodeEnum.NotFound);
      }),
      route('GET', 'fonts', async () =>
        PracticeBackend.json(200, [
          ...(await this.listStoredFonts()),
          ...[...this.fonts.values()].map(({ summary }) => summary),
        ]),
      ),
      route('POST', 'fonts', async ({ body }) =>
        this.addFont(
          await new Response(body).arrayBuffer(),
          FontSourceEnum.Upload,
        ),
      ),
      route('POST', 'font-catalog/import', async ({ body }) => {
        const request =
          await PracticeBackend.read<ImportCatalogFontRequest>(body);
        const url = new URL('font-catalog/download', this.apiUrl);
        url.search = new URLSearchParams({
          id: request.id,
          weight: String(request.weight),
          italic: String(request.italic),
          ...(request.subset ? { subset: request.subset } : {}),
        }).toString();
        // only downloaded, so the server stores nothing
        const downloaded = await this.realFetch(url);
        if (!downloaded.ok) return downloaded;
        return this.addFont(
          await downloaded.arrayBuffer(),
          FontSourceEnum.Catalog,
        );
      }),
      route('GET', 'users', ({ query }) =>
        PracticeBackend.json(200, this.page(this.users, query)),
      ),
      route('POST', 'users', async ({ body }) => {
        const request = await PracticeBackend.read<CreateUserRequest>(body);
        if (this.users.some((user) => user.email === request.email)) {
          return PracticeBackend.error(409, ApiErrorCodeEnum.EmailTaken);
        }
        const user: UserSummary = {
          id: this.id(),
          email: request.email.toLowerCase(),
          role: request.role,
          active: true,
          mustChangePassword: true,
          createdAt: this.timestamp(),
        };
        this.users.push(user);
        this.emit({ type: PracticeEventEnum.UserCreated });
        return PracticeBackend.json<CreatedUserResponse>(201, {
          user,
          password: 'practice-only-password',
        });
      }),
    ];
  }

  protected addCourse(request: CreateCourseRequest): PracticeCourse {
    const locale = request.locale ?? this.locale;
    const course: PracticeCourse = {
      id: this.id(),
      name: request.name,
      locale,
      dateFormat:
        request.dateFormat ?? CourseDateFormatter.DefaultFormats[locale],
      lookupEnabled: request.lookupEnabled ?? true,
      active: true,
      createdAt: this.timestamp(),
    };
    this.courses.push(course);
    return course;
  }

  protected addParticipant(
    courseId: number,
    request: CreateParticipantRequest,
  ): ParticipantSummary {
    const participant: ParticipantSummary = {
      id: this.id(),
      courseId,
      name: request.name.trim(),
      email: request.email.trim().toLowerCase(),
      fieldValues: {},
      certificate: null,
      createdAt: this.timestamp(),
    };
    this.participants.push(participant);
    return participant;
  }

  protected addTemplate(
    courseId: number,
    basePdf: string,
    template: TemplateContent,
    font: FontSummary | null,
  ): TemplateDetail {
    const detail: TemplateDetail = {
      id: this.id(),
      courseId,
      version: (this.findTemplate(courseId)?.version ?? 0) + 1,
      template,
      basePdf,
      fonts: font ? [font] : [],
      createdAt: this.timestamp(),
    };
    this.templates.push(detail);
    return detail;
  }

  // the server checks more; practice only needs each row's outcome
  protected importParticipants(
    courseId: number,
    request: ImportParticipantsRequest,
  ): ImportParticipantsResponse {
    const seen = new Map<string, number>();
    const rows: ImportRowResult[] = request.rows.map((row, index) => {
      const email = row.email.trim().toLowerCase();
      const name = row.name.trim();
      if (!name) {
        return {
          row: index,
          status: ImportRowStatusEnum.Invalid,
          errors: [ImportRowErrorEnum.NameRequired],
        };
      }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        return {
          row: index,
          status: ImportRowStatusEnum.Invalid,
          errors: [ImportRowErrorEnum.EmailInvalid],
        };
      }
      const earlier = seen.get(email);
      if (earlier !== undefined) {
        return {
          row: index,
          status: ImportRowStatusEnum.Skip,
          reason: ImportSkipReasonEnum.DuplicateInFile,
          duplicateOf: earlier,
        };
      }
      seen.set(email, index);
      if (this.hasEmail(courseId, email)) {
        return {
          row: index,
          status: ImportRowStatusEnum.Skip,
          reason: ImportSkipReasonEnum.Exists,
        };
      }
      if (!request.dryRun) this.addParticipant(courseId, { name, email });
      return { row: index, status: ImportRowStatusEnum.Create };
    });

    if (
      !request.dryRun
      && rows.some((row) => row.status === ImportRowStatusEnum.Create)
    ) {
      this.emit({ type: PracticeEventEnum.ParticipantsAdded, courseId });
    }
    const totals = Object.fromEntries(
      Object.values(ImportRowStatusEnum).map((status) => [
        status,
        rows.filter((row) => row.status === status).length,
      ]),
    ) as ImportParticipantsResponse['totals'];
    return { dryRun: request.dryRun, totals, rows, dateOrders: {} };
  }

  protected issue(
    courseId: number,
    request: IssueCertificatesRequest,
  ): Response {
    const template = this.findTemplate(courseId);
    if (!template || !this.canIssueWith(template)) {
      return PracticeBackend.error(409, ApiErrorCodeEnum.NoTemplate);
    }
    const wanted = request.participantIds
      ? new Set(request.participantIds)
      : null;
    const participantIds = this.participants
      .filter(
        (participant) =>
          participant.courseId === courseId
          && participant.certificate === null
          && (!wanted || wanted.has(participant.id)),
      )
      .map((participant) => participant.id);
    if (participantIds.length === 0) {
      return PracticeBackend.error(409, ApiErrorCodeEnum.NothingToIssue);
    }

    const now = this.now();
    const job: PracticeJob = {
      id: this.id(),
      courseId,
      type: JobTypeEnum.Issue,
      status: JobStatusEnum.Pending,
      progress: 0,
      total: participantIds.length,
      output: null,
      error: null,
      createdAt: now.toISOString(),
      startedAt: null,
      finishedAt: null,
      participantIds,
      issueDate: request.issueDate ?? PracticeBackend.localDateOf(now),
      createdMs: now.getTime(),
    };
    this.jobs.push(job);
    this.emit({ type: PracticeEventEnum.CertificatesIssued, courseId });
    return PracticeBackend.json<JobSummary>(202, PracticeBackend.toJob(job));
  }

  // a job moves on with time, and makes its certificates when it completes
  protected advanceJob(job: PracticeJob): JobSummary {
    if (job.status === JobStatusEnum.Completed) {
      return PracticeBackend.toJob(job);
    }
    const now = this.now();
    const elapsed = now.getTime() - job.createdMs;
    const share = Math.min(1, elapsed / PracticeBackend.JobDurationMs);
    const total = job.participantIds.length;
    job.status = share >= 1 ? JobStatusEnum.Completed : JobStatusEnum.Running;
    job.startedAt ??= now.toISOString();
    job.progress = Math.floor(share * total);

    if (job.status === JobStatusEnum.Completed) {
      const version = this.findTemplate(job.courseId)?.version ?? 1;
      for (const participant of this.participants) {
        if (!job.participantIds.includes(participant.id)) continue;
        Object.assign(participant, {
          certificate: {
            id: this.id(),
            code: PracticeBackend.codeOf(participant.id),
            status: CertificateStatusEnum.Active,
            templateVersion: version,
            issueDate: job.issueDate,
            revokedReason: null,
          },
        });
      }
      job.finishedAt = now.toISOString();
      job.output = { rendered: total, skipped: [] };
      this.emit({
        type: PracticeEventEnum.JobCompleted,
        courseId: job.courseId,
      });
    }
    return PracticeBackend.toJob(job);
  }

  protected listParticipants(
    courseId: number,
    query: URLSearchParams,
  ): ParticipantSummary[] {
    const search = query.get('search')?.trim().toLowerCase() ?? '';
    const filter = query.get('certificate');

    return this.participants
      .filter((participant) => participant.courseId === courseId)
      .filter(
        (participant) =>
          !search
          || participant.name.toLowerCase().includes(search)
          || participant.email.includes(search),
      )
      .filter((participant) => {
        if (!filter) return true;
        if (filter === 'none') return participant.certificate === null;
        return participant.certificate?.status === filter;
      })
      .toSorted((a, b) => a.name.localeCompare(b.name));
  }

  protected summaryOf(course: PracticeCourse): CourseSummary {
    const template = this.findTemplate(course.id);
    const participants = this.participants.filter(
      (participant) => participant.courseId === course.id,
    );
    const countOf = (status: string) =>
      participants.filter(
        (participant) => participant.certificate?.status === status,
      ).length;

    return {
      ...course,
      participantCount: participants.length,
      latestTemplateVersion: template?.version ?? null,
      latestTemplateHasName: template ? this.canIssueWith(template) : false,
      certificateCounts: {
        [CertificateStatusEnum.Active]: countOf(CertificateStatusEnum.Active),
        [CertificateStatusEnum.Revoked]: countOf(CertificateStatusEnum.Revoked),
      },
    };
  }

  // without a stored font the sample course can't print names, so it issues anyway
  protected canIssueWith(template: TemplateDetail): boolean {
    const fontless =
      template.courseId === this.sampleCourseId && template.fonts.length === 0;
    return fontless || hasParticipantNameField(template.template);
  }

  // a date and a QR code, and the name unless the tour is to add it
  protected sampleTemplate(
    font: FontSummary | null,
    withName: boolean,
  ): TemplateContent {
    const { fieldNames, fieldSamples } = this.texts;
    const qrcode = {
      name: fieldNames.qrcode,
      type: TemplateFieldTypeEnum.QrCode,
      position: { x: 252, y: 162 },
      width: 25,
      height: 25,
      content: fieldSamples.qrcode,
      backgroundColor: '#ffffff',
      barColor: '#000000',
    };
    if (!font) return { schemas: [[qrcode]] };

    const text = {
      fontName: font.sha256,
      alignment: 'center',
      verticalAlignment: 'middle',
      lineHeight: 1,
      characterSpacing: 0,
    };
    const date = {
      ...text,
      name: fieldNames.issueDate,
      type: TemplateFieldTypeEnum.IssueDate,
      position: { x: 108.5, y: 140 },
      width: 80,
      height: 10,
      fontSize: 14,
      fontColor: '#52525b',
      content: '',
    };
    const name = {
      ...text,
      name: fieldNames.participantName,
      type: TemplateFieldTypeEnum.ParticipantName,
      position: { x: 58.5, y: 92 },
      width: 180,
      height: 20,
      fontSize: 32,
      fontColor: '#18181b',
      content: fieldSamples.participantName,
    };
    return { schemas: [withName ? [name, date, qrcode] : [date, qrcode]] };
  }

  protected async findFirstFont(): Promise<FontSummary | null> {
    return (await this.listStoredFonts())[0] ?? null;
  }

  // the server's fonts, or none if they can't be read
  protected async listStoredFonts(): Promise<FontSummary[]> {
    try {
      const response = await this.realFetch(new URL('fonts', this.apiUrl));
      if (!response.ok) return [];
      return (await response.json()) as FontSummary[];
    } catch {
      return [];
    }
  }

  // read as the server would, and kept here; fontkit only loads once a font comes in
  protected async addFont(
    bytes: ArrayBuffer,
    source: FontSource,
  ): Promise<Response> {
    const { FontReader } = await import('@cert-it/fonts');
    const info = FontReader.Instance.read(new Uint8Array(bytes));
    if (info.isErr()) {
      return PracticeBackend.error(
        400,
        PracticeBackend.InvalidFontCodes[info.error.reason],
      );
    }

    const sha256 = await PracticeBackend.sha256Of(bytes);
    const stored = (await this.listStoredFonts()).find(
      (font) => font.sha256 === sha256,
    );
    const known = stored ?? this.fonts.get(sha256)?.summary;
    if (known) return PracticeBackend.json(200, known);

    const summary: FontSummary = {
      id: this.id(),
      sha256,
      family: info.value.family,
      style: info.value.style,
      source,
      createdAt: this.timestamp(),
    };
    this.fonts.set(sha256, { summary, bytes });
    return PracticeBackend.json(201, summary);
  }

  protected async previewFont(font: {
    summary: FontSummary;
    bytes: ArrayBuffer;
  }): Promise<Response> {
    const { TextOutliner } = await import('@cert-it/fonts');
    const outliner = TextOutliner.fromBytes(new Uint8Array(font.bytes));
    if (outliner.isErr()) {
      return PracticeBackend.error(400, ApiErrorCodeEnum.InvalidFont);
    }
    const { family, style } = font.summary;
    return PracticeBackend.json(
      200,
      outliner.value.outline(`${family} ${style}`),
    );
  }

  protected findCourse(id: string | undefined): PracticeCourse | null {
    return this.courses.find((course) => course.id === Number(id)) ?? null;
  }

  protected findTemplate(courseId: number): TemplateDetail | null {
    return (
      this.templates.findLast((template) => template.courseId === courseId)
      ?? null
    );
  }

  protected hasEmail(courseId: number, email: string): boolean {
    const normalized = email.trim().toLowerCase();
    return this.participants.some(
      (participant) =>
        participant.courseId === courseId && participant.email === normalized,
    );
  }

  protected page<T>(items: readonly T[], query: URLSearchParams): ApiPage<T> {
    const page = Math.max(1, Number(query.get('page') ?? 1) || 1);
    const size = Math.max(1, Number(query.get('size') ?? 25) || 25);
    return {
      items: items.slice((page - 1) * size, page * size),
      total: items.length,
      page,
      size,
    };
  }

  protected emit(event: PracticeEvent): void {
    for (const listener of this.listeners) listener(event);
  }

  protected id(): number {
    return this.nextId++;
  }

  protected timestamp(): string {
    return this.now().toISOString();
  }

  protected static toJob(job: PracticeJob): JobSummary {
    return {
      id: job.id,
      courseId: job.courseId,
      type: job.type,
      status: job.status,
      progress: job.progress,
      total: job.total,
      output: job.output,
      error: job.error,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
    };
  }

  // the local date, as the issue form shows today
  protected static localDateOf(date: Date): string {
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  // shaped like real codes, so tables show them the same way
  protected static codeOf(seed: number): string {
    const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < 10; i++) {
      code += letters[(seed * 7 + i * 13) % letters.length];
    }
    return `${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8)}`;
  }

  protected static json<T>(status: number, body: T): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  protected static error(status: number, code: ApiErrorCode): Response {
    return PracticeBackend.json(status, { error: code });
  }

  protected static async read<T>(
    body: BodyInit | null | undefined,
  ): Promise<T> {
    return (await new Response(body).json()) as T;
  }

  protected static async sha256Of(bytes: ArrayBuffer): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)]
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  }
}
