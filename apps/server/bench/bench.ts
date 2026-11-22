// Issuing benchmark: seeds a database with a course, a template and its
// participants, then issues their certificates through BackgroundJobService
// and the real generator process, while a Hono app answers requests. Checks
// time and memory against the targets and exits with 1 if one is missed.
//
// Usage: pnpm bench [--count 500] [--base light|heavy] [--font <file.ttf>]
//   --base   light: ~220 KB base PDF (typical), heavy: ~2.9 MB (stress)
//   --font   a TTF for the name field, e.g. a large CJK font, to stress memory
//
// pnpm bench builds the server and this file first, so the generator runs as
// it ships. The 2-minute target is for 1 vCPU: on a multi-core machine the
// time is optimistic. For the real figures run it in Docker with --cpus=1
// --memory=256m, where the container's memory is read from cgroup v2.
import { fork } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { parseArgs } from 'node:util';
import { serve } from '@hono/node-server';
import { JobStatusEnum } from '@cert-it/jobs';
import {
  FontSourceEnum,
  LocaleEnum,
  RoleEnum,
  TemplateFieldTypeEnum,
} from '@cert-it/shared';
import { Hono } from 'hono';
import type { CourseId } from '../src/course/Course';
import { DatabaseService } from '../src/database/DatabaseService';
import type { Job } from '../src/job/Job';
import { BackgroundJobService } from '../src/job/BackgroundJobService';
import { JobTypeEnum } from '../src/job/JobTypeEnum';
import type { ParticipantId } from '../src/participant/Participant';
import type { UserId } from '../src/user/User';
import { DataDirectoryService } from '../src/storage/DataDirectoryService';
import { normalizeEmail } from '../src/util/email/NormalizedEmail';

type Seeded = {
  courseId: CourseId;
  createdBy: UserId;
  participantIds: ParticipantId[];
};

const Targets = {
  idleMb: 80,
  peakMb: 256,
  // memory counts as returned when it's this close to idle again
  afterMarginMb: 15,
  seconds: 120,
  certificates: 500,
};
// side of a square of random RGB pixels, which doesn't compress
const BaseImageSide = { light: 270, heavy: 990 };
const ProbePort = 3999;
const BaseUrl = 'https://certs.example.org';
const Names = [
  'Ana Pérez',
  'José Ñúñez Gutiérrez',
  'María Fernanda de los Ángeles Rodríguez Villanueva-Castañeda',
  'Li Wei',
  'Jürgen Müller',
  'Zoë Ellington-Brown',
];

const { values: args } = parseArgs({
  options: {
    count: { type: 'string', default: String(Targets.certificates) },
    base: { type: 'string', default: 'light' },
    font: { type: 'string' },
    // internal: seeds the data directory in its own process, so its memory isn't the app's
    seed: { type: 'string' },
  },
});
const count = Number(args.count);
if (!Number.isInteger(count) || count < 1)
  fail('--count must be a positive integer');
if (!(args.base in BaseImageSide)) fail('--base must be light or heavy');
const base = args.base as keyof typeof BaseImageSide;

// from source the generator runs through the TypeScript loader, which inflates its memory
const fromSource = import.meta.url.endsWith('.ts');
// bundled, this file runs from bench/dist/
const BenchDir = new URL(fromSource ? './' : '../', import.meta.url);
const workerPath = fromSource
  ? undefined
  : new URL('../dist/generator.mjs', BenchDir);

const mb = (bytes: number) => Math.round(bytes / 1_048_576);
const rss = () => process.memoryUsage.rss();

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

// the container's non-reclaimable memory: what counts against its limit
function anon(): number | null {
  try {
    const stat = readFileSync('/sys/fs/cgroup/memory.stat', 'utf8');
    return Number(/^anon (\d+)/m.exec(stat)?.[1]);
  } catch {
    return null;
  }
}

// RSS of this process's children, from /proc; null where there's no /proc
function childrenRss(): number | null {
  try {
    let total = 0;
    for (const entry of readdirSync('/proc')) {
      if (!/^\d+$/.test(entry)) continue;
      try {
        const status = readFileSync(`/proc/${entry}/status`, 'utf8');
        if (Number(/^PPid:\s+(\d+)/m.exec(status)?.[1]) !== process.pid)
          continue;
        total += Number(/^VmRSS:\s+(\d+)/m.exec(status)?.[1] ?? 0) * 1024;
      } catch {
        // the process exited while being read
      }
    }
    return total;
  } catch {
    return null;
  }
}

async function settle() {
  for (let i = 0; i < 3; i += 1) {
    globalThis.gc?.();
    await sleep(500);
  }
}

function createBasePdf(path: string): Promise<void> {
  return new Promise((resolve, reject) => {
    fork(new URL('basePdf.mjs', BenchDir), [String(BaseImageSide[base]), path])
      .on('error', reject)
      .on('exit', (code) =>
        code === 0
          ? resolve()
          : reject(
              new Error(`Couldn't create the base PDF (exit code ${code})`),
            ),
      );
  });
}

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

// a course with its template and participants, as an editor would leave it before issuing
async function seed(
  database: DatabaseService,
  dataDirectory: DataDirectoryService,
  basePdfPath: string,
): Promise<Seeded> {
  const repositories = database.getRepositories();
  const user = repositories.users
    .create({
      email: normalizeEmail('bench@example.org'),
      passwordHash: 'bench',
      role: RoleEnum.Editor,
    })
    .unwrap();
  const course = repositories.courses
    .create({
      name: 'Bench',
      locale: LocaleEnum.Es,
      dateFormat: 'D [de] MMMM [de] YYYY',
    })
    .unwrap();

  const storeFont = async (bytes: Uint8Array, family: string) => {
    const hash = sha256(bytes);
    const font = repositories.fonts
      .create({
        sha256: hash,
        family,
        style: 'Regular',
        source: FontSourceEnum.Upload,
        fileName: `${hash}.ttf`,
      })
      .unwrap();
    await dataDirectory.writeFile(
      dataDirectory.getFontPath(font.fileName),
      bytes,
    );
    return hash;
  };
  const { getDefaultFont } = await import('@pdfme/common');
  const [defaultFont] = Object.values(getDefaultFont());
  const textFont = await storeFont(defaultFont!.data as Uint8Array, 'Roboto');
  const nameFont = args.font
    ? await storeFont(new Uint8Array(readFileSync(args.font)), 'Name')
    : textFont;

  const basePdf = readFileSync(basePdfPath);
  const basePdfFile = dataDirectory.getTemplateFile(course.id, sha256(basePdf));
  await dataDirectory.writeFile(basePdfFile, basePdf);
  const textField = {
    lineHeight: 1,
    characterSpacing: 0,
    backgroundColor: '',
    verticalAlignment: 'middle',
  };
  repositories.templateVersions
    .create({
      courseId: course.id,
      version: 1,
      basePdfPath: basePdfFile,
      createdBy: user.id,
      template: {
        schemas: [
          [
            {
              ...textField,
              name: 'name',
              type: TemplateFieldTypeEnum.ParticipantName,
              position: { x: 30, y: 85 },
              width: 237,
              height: 22,
              fontName: nameFont,
              fontSize: 36,
              alignment: 'center',
              fontColor: '#1a1a1a',
              dynamicFontSize: { min: 14, max: 36, fit: 'horizontal' },
            },
            {
              ...textField,
              name: 'date',
              type: TemplateFieldTypeEnum.IssueDate,
              position: { x: 30, y: 150 },
              width: 100,
              height: 10,
              fontName: textFont,
              fontSize: 14,
              alignment: 'left',
              fontColor: '#333333',
            },
            {
              name: 'qr',
              type: TemplateFieldTypeEnum.QrCode,
              position: { x: 240, y: 160 },
              width: 35,
              height: 35,
              backgroundColor: '#ffffff',
              barColor: '#000000',
            },
          ],
        ],
      },
    })
    .unwrap();

  const participantIds = Array.from(
    { length: count },
    (_, i) =>
      repositories.participants
        .create({
          courseId: course.id,
          name: Names[i % Names.length]!,
          email: normalizeEmail(`participant${i}@example.org`),
        })
        .unwrap().id,
  );

  return { courseId: course.id, createdBy: user.id, participantIds };
}

// the seeding process: writes the data directory, sends what it seeded and exits
if (args.seed) {
  const { root, basePdfPath } = JSON.parse(args.seed) as {
    root: string;
    basePdfPath: string;
  };
  const dataDirectory = new DataDirectoryService({ root });
  dataDirectory.start();
  const database = new DatabaseService({
    path: dataDirectory.getDatabasePath(),
  });
  database.start();
  const seeded = await seed(database, dataDirectory, basePdfPath);
  database.close();
  process.send!(seeded, () => process.exit(0));
  await new Promise(() => {});
}

function seedInChild(root: string, basePdfPath: string): Promise<Seeded> {
  const forwarded = args.font ? ['--font', args.font] : [];
  const child = fork(new URL(import.meta.url), [
    '--count',
    String(count),
    ...forwarded,
    '--seed',
    JSON.stringify({ root, basePdfPath }),
  ]);

  return new Promise((resolve, reject) => {
    child.once('message', (seeded) => resolve(seeded as Seeded));
    child.once('error', reject);
    child.once('exit', (code) => {
      if (code !== 0) reject(new Error(`Seeding failed (exit code ${code})`));
    });
  });
}

const workDir = mkdtempSync(join(tmpdir(), 'cert-it-bench-'));
const basePdfPath = join(workDir, 'base.pdf');
await createBasePdf(basePdfPath);
const basePdfBytes = statSync(basePdfPath).size;

const dataDirectory = new DataDirectoryService({ root: join(workDir, 'data') });
const seeded = await seedInChild(dataDirectory.getRoot(), basePdfPath);
// already migrated by the seeding process
const database = new DatabaseService({ path: dataDirectory.getDatabasePath() });
database.start();
const jobs = new BackgroundJobService({
  database,
  settings: () => ({
    databasePath: database.getPath(),
    dataDir: dataDirectory.getRoot(),
    baseUrl: BaseUrl,
  }),
  workerPath,
});
jobs.start();

const app = new Hono().get('/', (c) => c.text('ok'));
const server = serve({ fetch: app.fetch, port: ProbePort });
await fetch(`http://127.0.0.1:${ProbePort}/`);
await settle();
const idle = { rss: rss(), anon: anon() };

let appPeak = 0;
let anonPeak = 0;
let generatorPeak: number | null = null;
const sampler = setInterval(() => {
  appPeak = Math.max(appPeak, rss());
  anonPeak = Math.max(anonPeak, anon() ?? 0);
  const children = childrenRss();
  if (children !== null) generatorPeak = Math.max(generatorPeak ?? 0, children);
}, 25);

// the app must keep answering while the generator runs
const latencies: number[] = [];
const prober = setInterval(() => {
  const startedAt = performance.now();
  void fetch(`http://127.0.0.1:${ProbePort}/`).then(() =>
    latencies.push(performance.now() - startedAt),
  );
}, 200);

console.log(
  `Issuing ${count} certificates${fromSource ? ' from source' : ''}, ${base} base (${Math.round(basePdfBytes / 1024)} KB)${args.font ? `, name font ${args.font}` : ''}`,
);
const startedAt = performance.now();
const job = jobs
  .add({
    type: JobTypeEnum.Issue,
    payload: {
      participantIds: seeded.participantIds,
      issueDate: '2026-11-19',
    },
    courseId: seeded.courseId,
    total: count,
    createdBy: seeded.createdBy,
  })
  .unwrap();

let finished: Job | null = null;
let reported = 0;
while (!finished) {
  await sleep(100);
  const current = database.getRepositories().jobs.findById(job.id)!;
  if (current.progress >= reported + 100) {
    reported = current.progress - (current.progress % 100);
    console.log(`  ${reported}/${count}`);
  }
  if (
    current.status === JobStatusEnum.Completed
    || current.status === JobStatusEnum.Failed
  ) {
    finished = current;
  }
}
const seconds = (performance.now() - startedAt) / 1000;

await jobs.stop();
clearInterval(prober);
clearInterval(sampler);
await settle();
await sleep(2000);
const after = { rss: rss(), anon: anon() };
server.close();

if (finished.status === JobStatusEnum.Failed) {
  database.close();
  rmSync(workDir, { recursive: true, force: true });
  fail(`The job failed: ${finished.error}`);
}
const output = finished.output as { rendered: number; skipped: unknown[] };

const pdfs = readdirSync(
  join(dataDirectory.getRoot(), 'certificates', String(seeded.courseId)),
);
const pdfBytes = pdfs.reduce(
  (sum, file) =>
    sum
    + statSync(
      join(
        dataDirectory.getRoot(),
        'certificates',
        String(seeded.courseId),
        file,
      ),
    ).size,
  0,
);
database.close();
rmSync(workDir, { recursive: true, force: true });

latencies.sort((a, b) => a - b);
// in a container, anon covers both processes; elsewhere add up their RSS
const inContainer = idle.anon !== null;
const peak = inContainer ? anonPeak : appPeak + (generatorPeak ?? 0);
const afterMemory = inContainer ? after.anon! : after.rss;
const idleMemory = inContainer ? idle.anon! : idle.rss;
const scale = count / Targets.certificates;

const checks: [string, string, boolean, string][] = [
  [
    'Certificates',
    `${output.rendered} rendered, ${pdfs.length} files`,
    output.rendered === count && pdfs.length === count,
    `${count}`,
  ],
  [
    'Idle RSS',
    `${mb(idle.rss)} MB`,
    mb(idle.rss) < Targets.idleMb,
    `< ${Targets.idleMb} MB`,
  ],
  [
    inContainer
      ? 'Peak (container anon)'
      : generatorPeak === null
        ? 'Peak (app RSS only)'
        : 'Peak (app + generator RSS)',
    `${mb(peak)} MB`,
    mb(peak) < Targets.peakMb,
    `< ${Targets.peakMb} MB`,
  ],
  [
    inContainer ? 'After (container anon)' : 'After (app RSS)',
    `${mb(afterMemory)} MB (idle ${mb(idleMemory)} MB)`,
    mb(afterMemory - idleMemory) <= Targets.afterMarginMb,
    `within ${Targets.afterMarginMb} MB of idle`,
  ],
  [
    'Time',
    `${seconds.toFixed(1)} s (${Math.round((seconds * 1000) / count)} ms each)`,
    seconds < Targets.seconds * scale,
    `< ${Math.round(Targets.seconds * scale)} s for ${count}`,
  ],
];

console.log('');
for (const [name, value, passed, target] of checks) {
  console.log(
    `${passed ? 'PASS' : 'FAIL'}  ${name.padEnd(28)} ${value.padEnd(30)} target ${target}`,
  );
}
console.log(
  `\nApp peak ${mb(appPeak)} MB, generator peak ${generatorPeak === null ? 'not measured (no /proc)' : `${mb(generatorPeak)} MB`}, average PDF ${Math.round(pdfBytes / count / 1024)} KB`,
);
console.log(
  `App response while generating: median ${Math.round(latencies[Math.floor(latencies.length / 2)] ?? 0)} ms, worst ${Math.round(latencies.at(-1) ?? 0)} ms`,
);

process.exit(checks.every(([, , passed]) => passed) ? 0 : 1);
