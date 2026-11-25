import type { AuditLogRepository } from '../audit/repository/AuditLogRepository';
import type { SessionRepository } from '../auth/session/repository/SessionRepository';
import type { CertificateRepository } from '../certificate/repository/CertificateRepository';
import type { CourseRepository } from '../course/repository/CourseRepository';
import type { CourseFieldRepository } from '../field/repository/CourseFieldRepository';
import type { FontRepository } from '../font/repository/FontRepository';
import type { JobRepository } from '../job/repository/JobRepository';
import type { OnboardingRepository } from '../onboarding/repository/OnboardingRepository';
import type { ParticipantRepository } from '../participant/repository/ParticipantRepository';
import type { TemplateVersionRepository } from '../template/repository/TemplateVersionRepository';
import type { UserRepository } from '../user/repository/UserRepository';

/** Every repository of the app, bound to the database or to one transaction. */
export type Repositories = {
  readonly users: UserRepository;
  readonly sessions: SessionRepository;
  readonly courses: CourseRepository;
  readonly courseFields: CourseFieldRepository;
  readonly participants: ParticipantRepository;
  readonly fonts: FontRepository;
  readonly templateVersions: TemplateVersionRepository;
  readonly certificates: CertificateRepository;
  readonly jobs: JobRepository;
  readonly auditLog: AuditLogRepository;
  readonly onboarding: OnboardingRepository;
};
