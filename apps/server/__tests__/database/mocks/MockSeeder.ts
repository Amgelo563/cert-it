import {
  type CourseFieldType,
  CourseFieldTypeEnum,
  type FieldValues,
  fieldLabelKey,
  FontSourceEnum,
  LocaleEnum,
  RoleEnum,
  TemplateFieldTypeEnum,
} from '@cert-it/shared';
import type { Template } from '@pdfme/common';
import type { CertificateCode } from '../../../src/certificate/code/CertificateCode';
import type { Certificate } from '../../../src/certificate/Certificate';
import type { Course } from '../../../src/course/Course';
import type { CourseField } from '../../../src/field/CourseField';
import type { Repositories } from '../../../src/database/Repositories';
import type { Font } from '../../../src/font/Font';
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
        name: 'Test User',
        passwordHash: 'hash',
        role: options.role ?? RoleEnum.Editor,
      })
      .unwrap();

    return options.active === false
      ? users.update(user.id, { active: false }).unwrap()
      : user;
  }

  public course(
    options: Partial<
      Pick<
        Course,
        'name' | 'locale' | 'dateFormat' | 'lookupEnabled' | 'active'
      >
    > = {},
  ): Course {
    return this.repositories.courses
      .create({
        name: options.name ?? `Course ${this.next()}`,
        locale: options.locale ?? LocaleEnum.En,
        dateFormat: options.dateFormat ?? 'MMMM D, YYYY',
        lookupEnabled: options.lookupEnabled,
        active: options.active,
      })
      .unwrap();
  }

  public participant(
    course: Course,
    options: Partial<Pick<Participant, 'name'>> & {
      email?: string;
      fieldValues?: FieldValues;
    } = {},
  ): Participant {
    const n = this.next();
    return this.repositories.participants
      .create({
        courseId: course.id,
        name: options.name ?? `Participant ${n}`,
        email: normalizeEmail(options.email ?? `participant${n}@example.org`),
        fieldValues: options.fieldValues,
      })
      .unwrap();
  }

  /** Adds a field after the course's others, a text field by default. */
  public field(
    course: Course,
    options: {
      label?: string;
      type?: CourseFieldType;
      required?: boolean;
    } = {},
  ): CourseField {
    const n = this.next();
    const label = options.label ?? `Field ${n}`;
    return this.repositories.courseFields
      .create({
        courseId: course.id,
        label,
        labelKey: fieldLabelKey(label),
        type: options.type ?? CourseFieldTypeEnum.Text,
        required: options.required ?? false,
        position: this.repositories.courseFields.listByCourse(course.id).length,
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

  /** A template that prints the participant's name, so certificates can be issued from it. */
  public static readonly NamedTemplate: Omit<Template, 'basePdf'> = {
    schemas: [
      [
        {
          name: 'Name',
          type: TemplateFieldTypeEnum.ParticipantName,
          position: { x: 20, y: 50 },
          width: 100,
          height: 10,
        },
      ],
    ],
  };

  public templateVersion(
    course: Course,
    createdBy: User,
    template: Omit<Template, 'basePdf'> = MockSeeder.NamedTemplate,
  ): TemplateVersion {
    const version =
      (this.repositories.templateVersions.findLatest(course.id)?.version ?? 0)
      + 1;

    return this.repositories.templateVersions
      .create({
        courseId: course.id,
        version,
        template,
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
