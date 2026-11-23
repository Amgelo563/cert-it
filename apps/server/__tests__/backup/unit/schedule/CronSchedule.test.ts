import { describe, expect, test } from 'vite-plus/test';
import { CronSchedule } from '../../../../src/backup/schedule/CronSchedule';

// local time, as the schedule reads it
const at = (
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
) => new Date(year, month - 1, day, hour, minute);

function parse(expression: string): CronSchedule {
  const schedule = CronSchedule.parse(expression);
  if (!schedule) throw new Error(`Expected ${expression} to parse`);
  return schedule;
}

describe('CronSchedule (parse)', () => {
  test.each([
    '0 3 * * *',
    '*/15 * * * *',
    '0 0-6/2 1,15 * *',
    '30 2 * jan-mar mon-fri',
    '0 4 * * 7',
    '5/10 * * * *',
  ])('GIVEN %s WHEN parsed THEN is valid', (expression) => {
    expect(CronSchedule.parse(expression)).not.toBeNull();
  });

  test.each([
    '',
    '0 3 * *',
    '0 3 * * * *',
    '60 3 * * *',
    '0 24 * * *',
    '0 3 0 * *',
    '0 3 * 13 *',
    '0 3 * * 8',
    '*/0 * * * *',
    '5-1 * * * *',
    '0 3 * * funday',
    '1/2/3 * * * *',
    'a b c d e',
  ])('GIVEN %j WHEN parsed THEN is null', (expression) => {
    expect(CronSchedule.parse(expression)).toBeNull();
  });
});

describe('CronSchedule (matches)', () => {
  test('GIVEN a daily time WHEN checked THEN matches only that minute', () => {
    const schedule = parse('0 3 * * *');

    expect(schedule.matches(at(2026, 11, 23, 3, 0))).toBe(true);
    expect(schedule.matches(at(2026, 11, 23, 3, 1))).toBe(false);
    expect(schedule.matches(at(2026, 11, 23, 4, 0))).toBe(false);
  });

  test('GIVEN steps and ranges WHEN checked THEN matches each listed value', () => {
    const schedule = parse('*/20 8-10 * * *');

    expect(schedule.matches(at(2026, 11, 23, 8, 40))).toBe(true);
    expect(schedule.matches(at(2026, 11, 23, 10, 20))).toBe(true);
    expect(schedule.matches(at(2026, 11, 23, 9, 30))).toBe(false);
    expect(schedule.matches(at(2026, 11, 23, 11, 0))).toBe(false);
  });

  test('GIVEN week day names WHEN checked THEN matches those days', () => {
    // 2026-11-23 is a Monday
    const schedule = parse('0 3 * * mon,sun');

    expect(schedule.matches(at(2026, 11, 23, 3, 0))).toBe(true);
    expect(schedule.matches(at(2026, 11, 29, 3, 0))).toBe(true);
    expect(schedule.matches(at(2026, 11, 24, 3, 0))).toBe(false);
  });

  test('GIVEN day 7 WHEN checked THEN matches Sunday', () => {
    expect(parse('0 3 * * 7').matches(at(2026, 11, 29, 3, 0))).toBe(true);
  });

  test('GIVEN both day fields WHEN checked THEN matches either of them', () => {
    const schedule = parse('0 3 1 * mon');

    expect(schedule.matches(at(2026, 12, 1, 3, 0))).toBe(true);
    expect(schedule.matches(at(2026, 11, 23, 3, 0))).toBe(true);
    expect(schedule.matches(at(2026, 11, 24, 3, 0))).toBe(false);
  });

  test('GIVEN only the day of month WHEN checked THEN ignores the week day', () => {
    const schedule = parse('0 3 1 * *');

    expect(schedule.matches(at(2026, 12, 1, 3, 0))).toBe(true);
    expect(schedule.matches(at(2026, 11, 23, 3, 0))).toBe(false);
  });

  test('GIVEN month names WHEN checked THEN matches those months', () => {
    const schedule = parse('0 3 1 jan-mar *');

    expect(schedule.matches(at(2027, 2, 1, 3, 0))).toBe(true);
    expect(schedule.matches(at(2027, 4, 1, 3, 0))).toBe(false);
  });
});
