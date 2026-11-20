import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  CertificateStatusEnum,
  CourseDateFormatter,
  LocaleEnum,
  type Role,
  RoleEnum,
} from '@cert-it/shared';
import type { CertificateCode } from '../../certificate/code/CertificateCode';
import { type Config, ConfigSchema } from '../../config/schema/ConfigSchema';
import { DatabaseService } from '../../database/DatabaseService';
import { normalizeEmail } from '../../util/email/NormalizedEmail';
import { AppService, type AppServiceInjections } from '../AppService';

type DevUser = {
  email: string;
  role: Role;
  mustChangePassword: boolean;
};

/** The server for local development: no config file, an in-memory database with known users, and files in a temporary folder removed on stop. */
export class DevAppService extends AppService {
  /** Password of every dev user. */
  public static readonly Password = 'cert-it-dev';

  // what pnpm dev would otherwise read from config.yml
  protected static readonly DevConfig = {
    site: { baseUrl: 'http://localhost:3000', orgName: 'cert-it (dev)' },
    admin: { email: 'admin@cert-it.test' },
  };

  // one per role, plus one that has to change the password first
  protected static readonly Users: readonly DevUser[] = [
    {
      email: 'admin@cert-it.test',
      role: RoleEnum.Admin,
      mustChangePassword: false,
    },
    {
      email: 'editor@cert-it.test',
      role: RoleEnum.Editor,
      mustChangePassword: false,
    },
    {
      email: 'viewer@cert-it.test',
      role: RoleEnum.Viewer,
      mustChangePassword: false,
    },
    {
      email: 'new@cert-it.test',
      role: RoleEnum.Viewer,
      mustChangePassword: true,
    },
  ];

  public static override create(options?: {
    config?: Config;
    injections?: AppServiceInjections;
  }): DevAppService {
    const config =
      options?.config
      ?? ConfigSchema.parse({
        ...DevAppService.DevConfig,
        server: {
          dataDir: join(tmpdir(), `cert-it-dev-${process.pid}`),
        },
      });

    return new DevAppService(
      AppService.createServices({
        config,
        injections: {
          database: new DatabaseService({ path: ':memory:' }),
          ...options?.injections,
        },
      }),
    );
  }

  /** Stops the server and removes its temporary files. */
  public override async stop(): Promise<void> {
    await super.stop();
    await rm(this.dataDirectory.getRoot(), { recursive: true, force: true });
  }

  // known users instead of the first Admin with a random password
  protected override async startUsers(): Promise<void> {
    const { users } = this.database.getRepositories();
    const passwordHash = await this.passwords.hash(DevAppService.Password);

    for (const user of DevAppService.Users) {
      users
        .create({ ...user, email: normalizeEmail(user.email), passwordHash })
        .unwrap();
    }

    console.log(
      [
        `Dev users, all with the password ${DevAppService.Password}:`,
        ...DevAppService.Users.map(
          ({ email, role, mustChangePassword }) =>
            `  ${email} (${role}${mustChangePassword ? ', must change password' : ''})`,
        ),
      ].join('\n'),
    );

    await this.seedSampleCourse();
  }

  // a course with certificates on two template versions, one revoked, until issuing exists
  protected async seedSampleCourse(): Promise<void> {
    const { users, courses, participants, templateVersions, certificates } =
      this.database.getRepositories();
    const admin = users.findByEmail(
      normalizeEmail(DevAppService.Users[0]!.email),
    )!;
    const course = courses
      .create({
        name: 'Sample course',
        locale: LocaleEnum.En,
        dateFormat: CourseDateFormatter.DefaultFormats[LocaleEnum.En],
      })
      .unwrap();
    const versions = [1, 2].map((version) =>
      templateVersions
        .create({
          courseId: course.id,
          version,
          template: { schemas: [[]] },
          basePdfPath: `templates/${course.id}/v${version}.pdf`,
          createdBy: admin.id,
        })
        .unwrap(),
    );
    const samples = [
      {
        name: 'Ada Lovelace',
        code: 'DEVA-AAAA-01',
        version: 0,
        revoked: false,
      },
      {
        name: 'Grace Hopper',
        code: 'DEVA-AAAA-02',
        version: 1,
        revoked: false,
      },
      { name: 'Alan Turing', code: 'DEVA-AAAA-03', version: 1, revoked: true },
      { name: 'Edsger Dijkstra', code: null, version: 0, revoked: false },
    ];

    for (const sample of samples) {
      const participant = participants
        .create({
          courseId: course.id,
          name: sample.name,
          email: normalizeEmail(
            `${sample.name.split(' ')[0]!.toLowerCase()}@cert-it.test`,
          ),
        })
        .unwrap();
      if (sample.code === null) continue;

      const code = sample.code as CertificateCode;
      const certificate = certificates
        .create({
          code,
          courseId: course.id,
          participantId: participant.id,
          templateVersionId: versions[sample.version]!.id,
          issueDate: '2026-11-20',
        })
        .unwrap();
      if (sample.revoked) {
        certificates
          .update(certificate.id, {
            status: CertificateStatusEnum.Revoked,
            revokedAt: new Date(),
            revokedReason: 'Sample revocation',
          })
          .unwrap();
      }
      await this.dataDirectory.writeFile(
        this.dataDirectory.getCertificatePath(course.id, code),
        DevAppService.samplePdf(sample.name),
      );
    }
  }

  // one page with the name, so each sample file is recognizable
  protected static samplePdf(name: string): string {
    const text = `BT /F1 28 Tf 72 400 Td (Sample certificate: ${name}) Tj ET`;
    const objects = [
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
      `<< /Length ${text.length} >>\nstream\n${text}\nendstream`,
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    ];
    let pdf = '%PDF-1.4\n';
    const offsets = objects.map((body, index) => {
      const offset = pdf.length;
      pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
      return offset;
    });
    const xref = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    pdf += offsets
      .map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`)
      .join('');
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    return pdf;
  }

  // the admin dev server serves the panel, with hot reload
  protected override startAdminPanel(): Promise<void> {
    return Promise.resolve();
  }
}
