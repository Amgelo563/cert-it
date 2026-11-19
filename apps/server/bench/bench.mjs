// Issuing benchmark: generates certificates in a child
// process while a Hono app stands in for the server, then checks time and
// memory against the targets. Exits with 1 if a target is missed.
//
// Usage: pnpm bench [--count 500] [--base light|heavy] [--font <file.ttf>]
//   --base   light: ~220 KB base PDF (typical), heavy: ~2.9 MB (stress)
//   --font   a TTF for the name field, e.g. a large CJK font, to stress memory
//
// The 2-minute target is for 1 vCPU: on a multi-core machine the time is
// optimistic. For the real figures run it in Docker with --cpus=1
// --memory=256m, where the container's memory is read from cgroup v2.
import { fork } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { parseArgs } from 'node:util';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';

// same caps as the real generator process
const ChildFlags = ['--max-old-space-size=64', '--max-semi-space-size=3'];
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

const { values: args } = parseArgs({
  options: {
    count: { type: 'string', default: String(Targets.certificates) },
    base: { type: 'string', default: 'light' },
    font: { type: 'string' },
  },
});
const count = Number(args.count);
if (!Number.isInteger(count) || count < 1)
  fail('--count must be a positive integer');
if (!(args.base in BaseImageSide)) fail('--base must be light or heavy');

const mb = (bytes) => Math.round(bytes / 1_048_576);
const rss = () => process.memoryUsage.rss();

// the container's non-reclaimable memory: what counts against its limit
function anon() {
  try {
    const stat = readFileSync('/sys/fs/cgroup/memory.stat', 'utf8');
    return Number(/^anon (\d+)/m.exec(stat)?.[1]);
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

function fail(message) {
  console.error(message);
  process.exit(1);
}

const workDir = mkdtempSync(join(tmpdir(), 'cert-it-bench-'));
const basePdfPath = join(workDir, 'base.pdf');
await new Promise((resolve, reject) => {
  fork(new URL('./basePdf.mjs', import.meta.url), [
    String(BaseImageSide[args.base]),
    basePdfPath,
  ])
    .on('error', reject)
    .on('exit', (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`Couldn't create the base PDF (exit code ${code})`)),
    );
});
const basePdfBytes = statSync(basePdfPath).size;
const outDir = join(workDir, 'out');
mkdirSync(outDir);

const app = new Hono().get('/', (c) => c.text('ok'));
const server = serve({ fetch: app.fetch, port: ProbePort });
await fetch(`http://127.0.0.1:${ProbePort}/`);
await settle();
const idle = { rss: rss(), anon: anon() };

let appPeak = 0;
let anonPeak = 0;
const sampler = setInterval(() => {
  appPeak = Math.max(appPeak, rss());
  anonPeak = Math.max(anonPeak, anon() ?? 0);
}, 25);

// the app must keep answering while the generator runs
const latencies = [];
const prober = setInterval(() => {
  const startedAt = performance.now();
  void fetch(`http://127.0.0.1:${ProbePort}/`).then(() =>
    latencies.push(performance.now() - startedAt),
  );
}, 200);

console.log(
  `Generating ${count} certificates, ${args.base} base (${Math.round(basePdfBytes / 1024)} KB)${args.font ? `, name font ${args.font}` : ''}`,
);
const startedAt = performance.now();
const child = fork(
  new URL('./generator.mjs', import.meta.url),
  [JSON.stringify({ count, basePdfPath, outDir, nameFontPath: args.font })],
  { execArgv: ChildFlags },
);
const result = await new Promise((resolve, reject) => {
  child.on('message', (message) => {
    if (message.type === 'progress') console.log(`  ${message.done}/${count}`);
    if (message.type === 'done') resolve(message);
  });
  child.on('error', reject);
  child.on('exit', (code) =>
    reject(new Error(`The generator exited early with code ${code}`)),
  );
}).catch((error) => {
  rmSync(workDir, { recursive: true, force: true });
  fail(error.message);
});
const seconds = (performance.now() - startedAt) / 1000;

child.removeAllListeners('exit');
child.kill();
clearInterval(prober);
clearInterval(sampler);
await settle();
await sleep(2000);
const after = { rss: rss(), anon: anon() };
server.close();
rmSync(workDir, { recursive: true, force: true });

latencies.sort((a, b) => a - b);
// in a container, anon covers both processes; elsewhere add up their RSS
const inContainer = idle.anon !== null;
const peak = inContainer ? anonPeak : appPeak + result.peakRss;
const afterMemory = inContainer ? after.anon : after.rss;
const idleMemory = inContainer ? idle.anon : idle.rss;
const scale = count / Targets.certificates;

const checks = [
  [
    'Idle RSS',
    `${mb(idle.rss)} MB`,
    mb(idle.rss) < Targets.idleMb,
    `< ${Targets.idleMb} MB`,
  ],
  [
    inContainer ? 'Peak (container anon)' : 'Peak (app + generator RSS)',
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
  `\nApp peak ${mb(appPeak)} MB, generator peak ${mb(result.peakRss)} MB, average PDF ${Math.round(result.bytes / count / 1024)} KB`,
);
console.log(
  `App response while generating: median ${Math.round(latencies[Math.floor(latencies.length / 2)] ?? 0)} ms, worst ${Math.round(latencies.at(-1) ?? 0)} ms`,
);

process.exit(checks.every(([, , passed]) => passed) ? 0 : 1);
