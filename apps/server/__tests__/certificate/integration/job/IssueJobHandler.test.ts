import { readFileSync } from 'node:fs';
import type { JobContext } from '@cert-it/jobs';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  type Mock,
  test,
  vi,
} from 'vite-plus/test';
import { CertificateCodeGenerator } from '../../../../src/certificate/code/CertificateCodeGenerator';
import { IssueJobHandler } from '../../../../src/certificate/job/IssueJobHandler';
import { JobTypeEnum } from '@cert-it/shared';
import type { ParticipantId } from '../../../../src/participant/Participant';
import { readPdfCredential } from '../../../credential/mocks/readPdfCredential';
import { StubIssuerKeyService } from '../../../credential/mocks/StubIssuerKeyService';
import { verifyJwt } from '../../../credential/mocks/verifyJwt';
import { CertificateJobFixture } from '../../mocks/CertificateJobFixture';

const CodePattern = /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{2}$/;

let fixture: CertificateJobFixture;

beforeEach(() => {
  fixture = new CertificateJobFixture();
});

afterEach(() => {
  fixture.close();
});

function createContext(): { setProgress: Mock<JobContext['setProgress']> } {
  return { setProgress: vi.fn<JobContext['setProgress']>() };
}

function issueJob(participantIds: ParticipantId[]) {
  return fixture.job({
    type: JobTypeEnum.Issue,
    payload: { participantIds, issueDate: '2026-11-20' },
  });
}

describe('IssueJobHandler (run)', () => {
  test('GIVEN participants without certificates WHEN running THEN stores a PDF and a certificate for each, and reports progress', async () => {
    const version = await fixture.templateVersion();
    const ana = fixture.seed.participant(fixture.course, { name: 'Ana Pérez' });
    const bob = fixture.seed.participant(fixture.course, { name: 'Bob Smith' });
    const context = createContext();

    const output = (
      await IssueJobHandler.create(fixture.handlerOptions()).run(
        issueJob([ana.id, bob.id]),
        context,
      )
    ).unwrap();

    expect(output).toEqual({ rendered: 2, skipped: [] });
    const { certificates } = fixture.database.getRepositories();
    for (const participant of [ana, bob]) {
      const certificate = certificates.findByParticipant(participant.id)!;
      expect(certificate).toMatchObject({
        courseId: fixture.course.id,
        templateVersionId: version.id,
        issueDate: '2026-11-20',
      });
      expect(certificate.code).toMatch(CodePattern);
      const pdf = readFileSync(
        fixture.dataDirectory.getCertificatePath(
          fixture.course.id,
          certificate.code,
        ),
      );
      expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    }
    expect(context.setProgress.mock.calls).toEqual([[0, 2], [1], [2]]);
  });

  test('GIVEN a participant WHEN issuing THEN the PDF carries its signed credential, pointing at its status list index', async () => {
    await fixture.templateVersion();
    const ana = fixture.seed.participant(fixture.course, { name: 'Ana Pérez' });

    await IssueJobHandler.create(fixture.handlerOptions()).run(
      issueJob([ana.id]),
      createContext(),
    );

    const certificate = fixture.database
      .getRepositories()
      .certificates.findByParticipant(ana.id)!;
    const attached = await readPdfCredential(
      readFileSync(
        fixture.dataDirectory.getCertificatePath(
          fixture.course.id,
          certificate.code,
        ),
      ),
    );
    expect(attached?.name).toBe(`${certificate.code}.jwt`);
    const { payload } = verifyJwt(
      attached!.jwt,
      StubIssuerKeyService.sharedKey().getPublicJwk(),
    );
    expect(payload).toMatchObject({
      jti: `${CertificateJobFixture.BaseUrl}/c/${certificate.code}`,
      validFrom: '2026-11-20T00:00:00Z',
      credentialStatus: { statusListIndex: String(certificate.statusIndex) },
    });
  });

  test("GIVEN a name the font can't draw WHEN running THEN skips that participant with the missing characters and issues the rest", async () => {
    await fixture.templateVersion();
    const lukasz = fixture.seed.participant(fixture.course, { name: 'Łukasz' });
    const ana = fixture.seed.participant(fixture.course, { name: 'Ana' });

    const output = (
      await IssueJobHandler.create(fixture.handlerOptions()).run(
        issueJob([lukasz.id, ana.id]),
        createContext(),
      )
    ).unwrap();

    expect(output).toEqual({
      rendered: 1,
      skipped: [
        {
          participantId: lukasz.id,
          name: 'Łukasz',
          missing: [{ field: 'Name', type: 'participantName', missing: ['Ł'] }],
        },
      ],
    });
    const { certificates } = fixture.database.getRepositories();
    expect(certificates.findByParticipant(lukasz.id)).toBeNull();
    expect(certificates.findByParticipant(ana.id)).not.toBeNull();
  });

  test('GIVEN a job that already ran WHEN running it again THEN keeps the certificates and renders nothing', async () => {
    await fixture.templateVersion();
    const ana = fixture.seed.participant(fixture.course);
    const handler = IssueJobHandler.create(fixture.handlerOptions());
    await handler.run(issueJob([ana.id]), createContext());
    const { certificates } = fixture.database.getRepositories();
    const first = certificates.findByParticipant(ana.id)!;

    const output = (
      await handler.run(issueJob([ana.id]), createContext())
    ).unwrap();

    expect(output).toEqual({ rendered: 0, skipped: [] });
    expect(certificates.findByParticipant(ana.id)).toEqual(first);
  });

  test('GIVEN a participant of another course or one deleted WHEN running THEN skips them without output', async () => {
    await fixture.templateVersion();
    const other = fixture.seed.participant(fixture.seed.course());

    const output = (
      await IssueJobHandler.create(fixture.handlerOptions()).run(
        issueJob([other.id, 9_999 as ParticipantId]),
        createContext(),
      )
    ).unwrap();

    expect(output).toEqual({ rendered: 0, skipped: [] });
    expect(
      fixture.database
        .getRepositories()
        .certificates.findByParticipant(other.id),
    ).toBeNull();
  });

  test('GIVEN a generated code that is taken WHEN issuing THEN tries another', async () => {
    const version = await fixture.templateVersion();
    const taken = fixture.seed.certificate(
      fixture.seed.participant(fixture.course),
      version,
    );
    const ana = fixture.seed.participant(fixture.course);
    const codes = CertificateCodeGenerator.create();
    const generate = vi
      .spyOn(codes, 'generate')
      .mockReturnValueOnce(taken.code);

    await IssueJobHandler.create({
      ...fixture.handlerOptions(),
      injections: { codes },
    }).run(issueJob([ana.id]), createContext());

    const issued = fixture.database
      .getRepositories()
      .certificates.findByParticipant(ana.id)!;
    expect(issued.code).not.toBe(taken.code);
    expect(generate).toHaveBeenCalledTimes(2);
  });

  test('GIVEN a course without a template WHEN running THEN fails with NoTemplateError', async () => {
    const ana = fixture.seed.participant(fixture.course);

    const result = await IssueJobHandler.create(fixture.handlerOptions()).run(
      issueJob([ana.id]),
      createContext(),
    );

    expect(result.isErr() && result.error._tag).toBe('NoTemplateError');
  });
});
