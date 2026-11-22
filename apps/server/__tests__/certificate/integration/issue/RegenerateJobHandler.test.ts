import { readFileSync } from 'node:fs';
import type { JobContext } from '@cert-it/jobs';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vite-plus/test';
import type { CertificateId } from '../../../../src/certificate/Certificate';
import { IssueJobHandler } from '../../../../src/certificate/issue/IssueJobHandler';
import { RegenerateJobHandler } from '../../../../src/certificate/issue/RegenerateJobHandler';
import { JobTypeEnum } from '@cert-it/shared';
import type { Participant } from '../../../../src/participant/Participant';
import type { TemplateVersionId } from '../../../../src/template/TemplateVersion';
import { CertificateJobFixture } from '../../mocks/CertificateJobFixture';

let fixture: CertificateJobFixture;

beforeEach(() => {
  fixture = new CertificateJobFixture();
});

afterEach(() => {
  fixture.close();
});

async function issue(participants: Participant[]) {
  await new IssueJobHandler(fixture.handlerOptions()).run(
    fixture.job({
      type: JobTypeEnum.Issue,
      payload: {
        participantIds: participants.map(({ id }) => id),
        issueDate: '2026-11-20',
      },
    }),
    { setProgress: () => {} },
  );

  const { certificates } = fixture.database.getRepositories();
  return participants.map(({ id }) => certificates.findByParticipant(id)!);
}

function regenerateJob(
  certificateIds: CertificateId[],
  templateVersionId: TemplateVersionId,
) {
  return fixture.job({
    type: JobTypeEnum.Regenerate,
    payload: { certificateIds, templateVersionId },
  });
}

describe('RegenerateJobHandler (run)', () => {
  test('GIVEN certificates of an older version WHEN regenerating with the new one THEN rewrites their PDFs and keeps their codes and dates', async () => {
    await fixture.templateVersion(50);
    const [certificate] = await issue([
      fixture.seed.participant(fixture.course),
    ]);
    const path = fixture.dataDirectory.getCertificatePath(
      fixture.course.id,
      certificate!.code,
    );
    const before = readFileSync(path);
    const latest = await fixture.templateVersion(120);
    const context = { setProgress: vi.fn<JobContext['setProgress']>() };

    const output = (
      await new RegenerateJobHandler(fixture.handlerOptions()).run(
        regenerateJob([certificate!.id], latest.id),
        context,
      )
    ).unwrap();

    expect(output).toEqual({ rendered: 1, skipped: [] });
    expect(
      fixture.database.getRepositories().certificates.findById(certificate!.id),
    ).toMatchObject({
      code: certificate!.code,
      issueDate: '2026-11-20',
      templateVersionId: latest.id,
    });
    expect(readFileSync(path).equals(before)).toBe(false);
    expect(context.setProgress.mock.calls).toEqual([[0, 1], [1]]);
  });

  test("GIVEN a name the new version's font can't draw WHEN regenerating THEN skips it and keeps its version", async () => {
    const first = await fixture.templateVersion();
    const participant = fixture.seed.participant(fixture.course, {
      name: 'Ana',
    });
    const [certificate] = await issue([participant]);
    // a participant renamed after issuing, to a name the font can't draw
    fixture.database
      .getRepositories()
      .participants.update(participant.id, { name: 'Łukasz' })
      .unwrap();
    const latest = await fixture.templateVersion(120);

    const output = (
      await new RegenerateJobHandler(fixture.handlerOptions()).run(
        regenerateJob([certificate!.id], latest.id),
        { setProgress: () => {} },
      )
    ).unwrap();

    expect(output.rendered).toBe(0);
    expect(output.skipped).toMatchObject([
      { participantId: participant.id, name: 'Łukasz' },
    ]);
    expect(
      fixture.database.getRepositories().certificates.findById(certificate!.id)
        ?.templateVersionId,
    ).toBe(first.id);
  });

  test('GIVEN a template version of another course WHEN running THEN fails with ModelNotFoundError', async () => {
    const version = await fixture.templateVersion();
    const otherCourse = fixture.seed.course();
    const otherVersion = fixture.seed.templateVersion(
      otherCourse,
      fixture.editor,
    );

    const result = await new RegenerateJobHandler(fixture.handlerOptions()).run(
      regenerateJob([], otherVersion.id),
      { setProgress: () => {} },
    );

    expect(version.courseId).toBe(fixture.course.id);
    expect(result.isErr() && result.error._tag).toBe('ModelNotFoundError');
  });
});
