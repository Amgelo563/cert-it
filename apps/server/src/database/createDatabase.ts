import { SqliteDatabase } from '@cert-it/data';
import { SqliteAuditLogRepository } from '../audit/repository/SqliteAuditLogRepository';
import { SqliteSessionRepository } from '../auth/session/repository/SqliteSessionRepository';
import { SqliteCertificateRepository } from '../certificate/repository/SqliteCertificateRepository';
import { SqliteCourseRepository } from '../course/repository/SqliteCourseRepository';
import { SqliteFontRepository } from '../font/repository/SqliteFontRepository';
import { SqliteJobRepository } from '../job/repository/SqliteJobRepository';
import { SqliteParticipantRepository } from '../participant/repository/SqliteParticipantRepository';
import { SqliteTemplateVersionRepository } from '../template/repository/SqliteTemplateVersionRepository';
import { SqliteUserRepository } from '../user/repository/SqliteUserRepository';
import type { Repositories } from './Repositories';

/** Opens the app's SQLite database at the given path, or `:memory:`. Call `start()` on it before using it. */
export function createDatabase(options: {
  path: string;
  /** Folder with the drizzle-kit migrations. */
  migrationsFolder: string;
}): SqliteDatabase<Repositories> {
  return SqliteDatabase.create<Repositories>({
    ...options,
    createRepositories: (db) => ({
      users: new SqliteUserRepository({ db }),
      sessions: new SqliteSessionRepository({ db }),
      courses: new SqliteCourseRepository({ db }),
      participants: new SqliteParticipantRepository({ db }),
      fonts: new SqliteFontRepository({ db }),
      templateVersions: new SqliteTemplateVersionRepository({ db }),
      certificates: new SqliteCertificateRepository({ db }),
      jobs: new SqliteJobRepository({ db }),
      auditLog: new SqliteAuditLogRepository({ db }),
    }),
  });
}
