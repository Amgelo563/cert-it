// Dev only: adds two test certificates and their PDFs, for check.sh.
// Run inside an app container: docker compose exec -T app-path node seed.mjs
//
//   DEVA-CTIV-EA  active, serves its PDF
//   DEVR-EVOK-ED  revoked, answers 404
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';

const DataDir = '/app/data';
const Active = 'DEVA-CTIV-EA';
const Revoked = 'DEVR-EVOK-ED';

const db = new Database(join(DataDir, 'app.db'));
db.pragma('busy_timeout = 5000');
const now = Date.now();

const seed = db.transaction(() => {
  const existing = db
    .prepare('SELECT course_id FROM certificates WHERE code = ?')
    .get(Active);
  if (existing) return existing.course_id;

  const userId = db
    .prepare(
      `INSERT INTO users (email, password_hash, role, created_at)
       VALUES ('dev-seed@example.org', 'unusable', 'viewer', ?)
       ON CONFLICT (email) DO UPDATE SET email = excluded.email
       RETURNING id`,
    )
    .get(now).id;
  const courseId = db
    .prepare(
      `INSERT INTO courses (name, locale, date_format, created_at)
       VALUES ('Dev seed course', 'en', 'MMMM D, YYYY', ?) RETURNING id`,
    )
    .get(now).id;
  const versionId = db
    .prepare(
      `INSERT INTO template_versions (course_id, version, template, base_pdf_path, created_by, created_at)
       VALUES (?, 1, '{"schemas":[[]]}', ?, ?, ?) RETURNING id`,
    )
    .get(courseId, `templates/${courseId}/v1.pdf`, userId, now).id;

  // lowest status index not used or retired
  const isIndexTaken = db.prepare(
    `SELECT 1 FROM certificates WHERE status_index = ?
     UNION ALL SELECT 1 FROM retired_status_indexes WHERE status_index = ?`,
  );
  const freeIndex = () => {
    let index = 0;
    while (isIndexTaken.get(index, index)) index++;
    return index;
  };

  for (const [code, status] of [
    [Active, 'active'],
    [Revoked, 'revoked'],
  ]) {
    const participantId = db
      .prepare(
        `INSERT INTO participants (course_id, name, email, extra, created_at)
         VALUES (?, ?, ?, '{}', ?) RETURNING id`,
      )
      .get(courseId, `Dev ${status}`, `${status}@example.org`, now).id;
    db.prepare(
      `INSERT INTO certificates (code, status_index, course_id, participant_id, template_version_id, issue_date, status, revoked_at, revoked_reason, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, '2026-11-19', ?, ?, ?, ?, ?)`,
    ).run(
      code,
      freeIndex(),
      courseId,
      participantId,
      versionId,
      status,
      status === 'revoked' ? now : null,
      status === 'revoked' ? 'Dev seed' : null,
      now,
      now,
    );
  }

  return courseId;
});

const courseId = seed();
db.close();

// a one-page PDF; its size doesn't matter, only that Range requests can cut it
const pdf = [
  '%PDF-1.4',
  '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
  '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
  '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] >> endobj',
  'trailer << /Root 1 0 R >>',
  '%%EOF',
  '',
].join('\n');

const folder = join(DataDir, 'certificates', String(courseId));
mkdirSync(folder, { recursive: true });
for (const code of [Active, Revoked]) {
  writeFileSync(join(folder, `${code}.pdf`), pdf);
}

console.log(
  `Seeded course ${courseId}: ${Active} (active), ${Revoked} (revoked), ${pdf.length} bytes each`,
);
