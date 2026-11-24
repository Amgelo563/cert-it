import { describe, expect, test } from 'vite-plus/test';
import { RateLimiter } from '../../../src/rateLimit/RateLimiter';

function createLimiter() {
  const clock = { now: 1_000_000 };
  const limiter = new RateLimiter({
    maxHits: 3,
    windowMs: 60_000,
    now: () => clock.now,
  });

  return { clock, limiter };
}

describe('RateLimiter (hit)', () => {
  test('GIVEN hits under the limit WHEN hitting THEN allows them', () => {
    const { limiter } = createLimiter();

    expect([limiter.hit('a'), limiter.hit('a'), limiter.hit('a')]).toEqual([
      0, 0, 0,
    ]);
  });

  test('GIVEN a key at the limit WHEN hitting THEN returns the seconds until its oldest hit leaves the window', () => {
    const { clock, limiter } = createLimiter();
    limiter.hit('a');
    clock.now += 20_000;
    limiter.hit('a');
    limiter.hit('a');

    expect(limiter.hit('a')).toBe(40);
  });

  test('GIVEN a key at the limit WHEN another key hits THEN allows it', () => {
    const { limiter } = createLimiter();
    for (let i = 0; i < 3; i++) limiter.hit('a');

    expect(limiter.hit('b')).toBe(0);
  });

  test('GIVEN a key at the limit WHEN its oldest hit leaves the window THEN allows one more', () => {
    const { clock, limiter } = createLimiter();
    limiter.hit('a');
    clock.now += 30_000;
    limiter.hit('a');
    limiter.hit('a');
    clock.now += 30_000;

    expect(limiter.hit('a')).toBe(0);
    expect(limiter.hit('a')).toBeGreaterThan(0);
  });

  test('GIVEN a refused hit WHEN the window passes THEN the refusal did not count', () => {
    const { clock, limiter } = createLimiter();
    for (let i = 0; i < 3; i++) limiter.hit('a');
    clock.now += 59_000;
    limiter.hit('a');
    clock.now += 1_000;

    expect(limiter.hit('a')).toBe(0);
  });
});

describe('RateLimiter (check)', () => {
  test('GIVEN a key under the limit WHEN checking it THEN returns 0 without recording a hit', () => {
    const { limiter } = createLimiter();
    for (let i = 0; i < 5; i++) limiter.check('a');

    expect([limiter.hit('a'), limiter.hit('a'), limiter.hit('a')]).toEqual([
      0, 0, 0,
    ]);
  });

  test('GIVEN a key at the limit WHEN checking it THEN returns the seconds to wait', () => {
    const { limiter } = createLimiter();
    for (let i = 0; i < 3; i++) limiter.hit('a');

    expect(limiter.check('a')).toBe(60);
  });
});

describe('RateLimiter (reset)', () => {
  test('GIVEN a key at the limit WHEN resetting it THEN allows it again', () => {
    const { limiter } = createLimiter();
    for (let i = 0; i < 3; i++) limiter.hit('a');

    limiter.reset('a');

    expect(limiter.hit('a')).toBe(0);
  });
});
