import { RoleEnum } from '@cert-it/shared';
import type { CertificateCode } from '../../../src/certificate/code/CertificateCode';
import type { Certificate } from '../../../src/certificate/Certificate';
import { LocaleEnum } from '../../../src/config/schema/enums/LocaleEnum';
import type { Course } from '../../../src/course/Course';
import type { Repositories } from '../../../src/database/Repositories';
import type { Font } from '../../../src/font/Font';
import { FontSourceEnum } from '../../../src/font/FontSourceEnum';
import type { Participant } from '../../../src/participant/Participant';
import type { TemplateVersion } from '../../../src/template/TemplateVersion';
import type { User } from '../../../src/user/User';

import { normalizeEmail } from '../../../src/util/email/NormalizedEmail';

/** Creates models with valid defaults, for tests that only care about a few fields. */
export class MockSeeder {
  protected readonly repositories: Repositories;

  protected sequence = 0;

  constructor(repositories: Repositories) {
    this.repositories = repositories;
  }

  public user(options: Partial<Pick<User, 'role' | 'active'>> = {}): User {
    const { users } = this.repositories;
    const user = users
      .create({
        email: normalizeEmail(`user${this.next()}@example.org`),
        passwordHash: 'hash',
        role: options.role ?? RoleEnum.Editor,
      })
      .unwrap();

    return options.active === false
      ? users.update(user.id, { active: false }).unwrap()
      : user;
  }

  public course(
    options: Partial<Pick<Course, 'name' | 'lookupEnabled' | 'active'>> = {},
  ): Course {
    return this.repositories.courses
      .create({
        name: options.name ?? `Course ${this.next()}`,
        locale: LocaleEnum.En,
        dateFormat: 'MMMM D, YYYY',
        lookupEnabled: options.lookupEnabled,
        active: options.active,
      })
      .unwrap();
  }

  public participant(
    course: Course,
    options: Partial<Pick<Participant, 'name'>> & { email?: string } = {},
  ): Participant {
    const n = this.next();
    return this.repositories.participants
      .create({
        courseId: course.id,
        name: options.name ?? `Participant ${n}`,
        email: normalizeEmail(options.email ?? `participant${n}@example.org`),
      })
      .unwrap();
  }

  public font(): Font {
    const sha256 = this.next().toString(16).padStart(64, '0');
    return this.repositories.fonts
      .create({
        sha256,
        family: 'Georgia',
        style: 'Regular',
        source: FontSourceEnum.Upload,
        fileName: `${sha256}.ttf`,
      })
      .unwrap();
  }

  public templateVersion(course: Course, createdBy: User): TemplateVersion {
    const version =
      (this.repositories.templateVersions.findLatest(course.id)?.version ?? 0)
      + 1;

    return this.repositories.templateVersions
      .create({
        courseId: course.id,
        version,
        template: { schemas: [[]] },
        basePdfPath: `templates/${course.id}/v${version}.pdf`,
        createdBy: createdBy.id,
      })
      .unwrap();
  }

  public certificate(
    participant: Participant,
    templateVersion: TemplateVersion,
  ): Certificate {
    return this.repositories.certificates
      .create({
        code: `CODE-${this.next().toString().padStart(4, '0')}-XX` as CertificateCode,
        courseId: participant.courseId,
        participantId: participant.id,
        templateVersionId: templateVersion.id,
        issueDate: '2026-11-18',
      })
      .unwrap();
  }

  protected next(): number {
    this.sequence += 1;
    return this.sequence;
  }
}
