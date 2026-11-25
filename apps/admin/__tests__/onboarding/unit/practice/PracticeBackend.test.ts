import {
  ApiErrorCodeEnum,
  type CurrentUser,
  type FontSummary,
  FontSourceEnum,
  JobStatusEnum,
  LocaleEnum,
  RoleEnum,
  TemplateFieldTypeEnum,
} from '@cert-it/shared';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test, vi } from 'vite-plus/test';
import { ApiClient } from '../../../../src/app/api/ApiClient';
import { ApiRequestError } from '../../../../src/app/api/errors/ApiRequestError';
import { PracticeBackend } from '../../../../src/onboarding/practice/PracticeBackend';
import {
  type PracticeEvent,
  PracticeEventEnum,
} from '../../../../src/onboarding/practice/PracticeEventEnum';

const BaseUrl = new URL('https://example.org/certs/');

const User: CurrentUser = {
  id: 1,
  email: 'admin@example.org',
  role: RoleEnum.Admin,
  mustChangePassword: false,
};

function urlOf(input: RequestInfo | URL): URL {
  return new URL(input instanceof Request ? input.url : input);
}

const FontFile = readFileSync(
  join(import.meta.dirname, '../../fixtures/basic.ttf'),
);

const StoredFont: FontSummary = {
  id: 1,
  sha256: 'a'.repeat(64),
  family: 'Inter',
  style: 'Regular',
  source: FontSourceEnum.Upload,
  createdAt: '2026-11-24T00:00:00.000Z',
};

// a practice backend on a clock the test moves, behind a real API client
async function setup(options: { fonts?: FontSummary[] } = {}) {
  let now = new Date('2026-11-24T12:00:00.000Z');
  // the server's font list, and a catalog whose only font is the fixture
  const realFetch = vi.fn<typeof fetch>((input) => {
    const url = urlOf(input);
    if (url.pathname.endsWith('/font-catalog/download')) {
      return Promise.resolve(
        url.searchParams.get('id') === 'basic'
          ? new Response(new Uint8Array(FontFile))
          : new Response(JSON.stringify({ error: 'not_found' }), {
              status: 404,
            }),
      );
    }
    return Promise.resolve(
      new Response(JSON.stringify(options.fonts ?? [StoredFont]), {
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  });
  const backend = PracticeBackend.create({
    locale: LocaleEnum.En,
    currentUser: User,
    texts: {
      courseName: 'Sample course',
      draftCourseName: 'Draft course',
      participantNames: ['Alex Morgan', 'Sam Rivera'],
      teammateEmail: 'teammate@example.org',
      pdf: {
        title: 'Certificate',
        intro: 'This certifies that',
        outro: 'did it',
      },
      fieldNames: { participantName: 'Name', issueDate: 'Date', qrcode: 'QR' },
      fieldSamples: { participantName: 'Alex', qrcode: 'https://example.org' },
    },
    injections: {
      realFetch,
      apiUrl: new URL('api/', BaseUrl),
      now: () => now,
    },
  });
  await backend.start();
  realFetch.mockClear();

  const api = ApiClient.create({
    injections: { baseUrl: BaseUrl, fetch: backend.fetch },
  });
  const events: PracticeEvent[] = [];
  backend.onEvent((event) => events.push(event));
  const later = (ms: number) => {
    now = new Date(now.getTime() + ms);
  };

  return { backend, api, events, realFetch, later };
}

describe('PracticeBackend (seed)', () => {
  test('GIVEN a started backend WHEN listing courses THEN answers the sample course first, with its participants and named template', async () => {
    const { backend, api } = await setup();

    const page = await api.request((routes) =>
      routes.courses.$get({ query: {} }),
    );

    expect(page.items.map((course) => course.name)).toEqual([
      'Sample course',
      'Draft course',
    ]);
    expect(page.items[0]).toMatchObject({
      id: backend.getSampleCourseId(),
      participantCount: 2,
      latestTemplateVersion: 1,
      latestTemplateHasName: true,
    });
    expect(page.items[1]).toMatchObject({ latestTemplateHasName: false });
  });

  test('GIVEN the draft course WHEN reading its template THEN it has only the QR code and no font, for the tour to add', async () => {
    const { backend, api } = await setup();

    const detail = await api.request((routes) =>
      routes.courses[':courseId'].template.$get({
        param: { courseId: String(backend.getDraftCourseId()) },
      }),
    );

    expect(detail?.template.schemas[0]?.map((field) => field.type)).toEqual([
      TemplateFieldTypeEnum.QrCode,
    ]);
    expect(detail?.fonts).toEqual([]);
  });
});

describe('PracticeBackend (writes)', () => {
  test('GIVEN a new course WHEN created THEN lists it and tells the tour', async () => {
    const { api, events } = await setup();

    const course = await api.request((routes) =>
      routes.courses.$post({ json: { name: 'Mine' } }),
    );
    const page = await api.request((routes) =>
      routes.courses.$get({ query: {} }),
    );

    expect(page.items[0]?.id).toBe(course.id);
    expect(events).toEqual([
      { type: PracticeEventEnum.CourseCreated, courseId: course.id },
    ]);
  });

  test('GIVEN an email the course has WHEN adding a participant THEN answers participant_email_taken', async () => {
    const { backend, api } = await setup();
    const param = { courseId: String(backend.getSampleCourseId()) };

    const error = await api
      .request((routes) =>
        routes.courses[':courseId'].participants.$post({
          param,
          json: { name: 'Again', email: 'Participant1@example.org' },
        }),
      )
      .catch((caught: unknown) => caught);

    expect(
      ApiRequestError.matches(error, ApiErrorCodeEnum.ParticipantEmailTaken),
    ).toBe(true);
  });

  test('GIVEN a dry run WHEN importing THEN reports each row and adds no one', async () => {
    const { backend, api, events } = await setup();
    const param = { courseId: String(backend.getSampleCourseId()) };

    const result = await api.request((routes) =>
      routes.courses[':courseId'].participants.import.$post({
        param,
        json: {
          mode: 'skip',
          dryRun: true,
          rows: [
            { name: 'New', email: 'new@example.org' },
            { name: 'Twice', email: 'new@example.org' },
            { name: '', email: 'empty@example.org' },
            { name: 'Known', email: 'participant1@example.org' },
          ],
        },
      }),
    );
    const page = await api.request((routes) =>
      routes.courses[':courseId'].participants.$get({ param, query: {} }),
    );

    expect(result.totals).toEqual({
      create: 1,
      update: 0,
      skip: 2,
      invalid: 1,
    });
    expect(page.total).toBe(2);
    expect(events).toEqual([]);
  });

  test('GIVEN a template saved without the name WHEN saving THEN tells the tour it has none', async () => {
    const { backend, api, events } = await setup();
    const courseId = backend.getDraftCourseId();
    const param = { courseId: String(courseId) };
    const current = await api.request((routes) =>
      routes.courses[':courseId'].template.$get({ param }),
    );

    const saved = await api.request((routes) =>
      routes.courses[':courseId'].template.$post({
        param,
        json: { basePdf: current!.basePdf, template: current!.template },
      }),
    );

    expect(saved.version).toBe(2);
    expect(events).toEqual([
      { type: PracticeEventEnum.TemplateSaved, courseId, hasName: false },
    ]);
  });
});

describe('PracticeBackend (issue)', () => {
  test('GIVEN the sample course WHEN issuing and the job runs its course THEN every participant gets a certificate', async () => {
    const { backend, api, events, later } = await setup();
    const courseId = backend.getSampleCourseId();
    const param = { courseId: String(courseId) };

    const job = await api.request((routes) =>
      routes.courses[':courseId'].certificates.issue.$post({ param, json: {} }),
    );
    later(1000);
    const running = await api.request((routes) =>
      routes.courses[':courseId'].jobs[':id'].$get({
        param: { ...param, id: String(job.id) },
      }),
    );
    later(5000);
    const done = await api.request((routes) =>
      routes.courses[':courseId'].jobs[':id'].$get({
        param: { ...param, id: String(job.id) },
      }),
    );
    const page = await api.request((routes) =>
      routes.courses[':courseId'].participants.$get({ param, query: {} }),
    );

    expect(job).toMatchObject({ status: JobStatusEnum.Pending, total: 2 });
    expect(running.status).toBe(JobStatusEnum.Running);
    expect(done).toMatchObject({
      status: JobStatusEnum.Completed,
      output: { rendered: 2, skipped: [] },
    });
    expect(page.items.every((participant) => participant.certificate)).toBe(
      true,
    );
    expect(events.map((event) => event.type)).toEqual([
      PracticeEventEnum.CertificatesIssued,
      PracticeEventEnum.JobCompleted,
    ]);
  });

  test('GIVEN the draft course without the name WHEN issuing THEN answers no_template', async () => {
    const { backend, api } = await setup();

    const error = await api
      .request((routes) =>
        routes.courses[':courseId'].certificates.issue.$post({
          param: { courseId: String(backend.getDraftCourseId()) },
          json: {},
        }),
      )
      .catch((caught: unknown) => caught);

    expect(ApiRequestError.matches(error, ApiErrorCodeEnum.NoTemplate)).toBe(
      true,
    );
  });
});

describe('PracticeBackend (routing)', () => {
  test('GIVEN a route practice has no copy of WHEN called THEN answers unavailable_in_practice without reaching the server', async () => {
    const { backend, api, realFetch } = await setup();

    const error = await api
      .request((routes) =>
        routes.courses[':id'].$delete({
          param: { id: String(backend.getSampleCourseId()) },
        }),
      )
      .catch((caught: unknown) => caught);

    expect(
      ApiRequestError.matches(error, ApiErrorCodeEnum.UnavailableInPractice),
    ).toBe(true);
    expect(realFetch).not.toHaveBeenCalled();
  });

  test('GIVEN the session and font reads WHEN called THEN they go to the server', async () => {
    const { api, realFetch } = await setup();

    await api.request((routes) => routes.auth.me.$get());
    await api.request((routes) => routes.fonts.$get());

    expect(realFetch).toHaveBeenCalledTimes(2);
  });
});

describe('PracticeBackend (fonts)', () => {
  test('GIVEN a catalog font WHEN importing THEN downloads it, keeps it here and lists it with the stored ones', async () => {
    const { api, realFetch } = await setup();

    const font = await api.request((routes) =>
      routes['font-catalog'].import.$post({
        json: { id: 'basic', weight: 400, italic: false },
      }),
    );
    const fonts = await api.request((routes) => routes.fonts.$get());
    const bytes = await api.requestBytes((routes) =>
      routes.fonts[':sha256'].$get({ param: { sha256: font.sha256 } }),
    );

    expect(font.source).toBe(FontSourceEnum.Catalog);
    expect(fonts.map(({ sha256 }) => sha256)).toEqual([
      StoredFont.sha256,
      font.sha256,
    ]);
    expect(new Uint8Array(bytes)).toEqual(new Uint8Array(FontFile));
    expect(
      realFetch.mock.calls.map(([input]) => urlOf(input).pathname),
    ).not.toContain('/certs/api/font-catalog/import');
  });

  test('GIVEN a font the catalog lacks WHEN importing THEN answers the server error', async () => {
    const { api } = await setup();

    const error = await api
      .request((routes) =>
        routes['font-catalog'].import.$post({
          json: { id: 'missing', weight: 400, italic: false },
        }),
      )
      .catch((caught: unknown) => caught);

    expect(ApiRequestError.matches(error, ApiErrorCodeEnum.NotFound)).toBe(
      true,
    );
  });

  test('GIVEN a file that is not a font WHEN uploading THEN answers invalid_font', async () => {
    const { api } = await setup();

    const error = await api
      .request((routes) =>
        routes.fonts.$post({}, { init: { body: new Blob(['not a font']) } }),
      )
      .catch((caught: unknown) => caught);

    expect(ApiRequestError.matches(error, ApiErrorCodeEnum.InvalidFont)).toBe(
      true,
    );
  });

  test('GIVEN an uploaded font WHEN previewing it THEN draws its name in it', async () => {
    const { api } = await setup();
    const font = await api.request((routes) =>
      routes.fonts.$post({}, { init: { body: new Blob([FontFile]) } }),
    );

    const preview = await api.request((routes) =>
      routes.fonts[':sha256'].preview.$get({
        param: { sha256: font.sha256 },
      }),
    );

    expect(font.source).toBe(FontSourceEnum.Upload);
    expect(preview.path).toMatch(/^M/);
  });
});
