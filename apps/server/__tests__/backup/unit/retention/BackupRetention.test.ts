import { describe, expect, test } from 'vite-plus/test';
import { BackupFileName } from '../../../../src/backup/archive/BackupFileName';
import { BackupRetention } from '../../../../src/backup/retention/BackupRetention';

const Now = new Date('2026-11-23T03:00:00Z');
const Day = 24 * 60 * 60 * 1000;

// the name of a backup taken the given number of days ago
const daysAgo = (days: number) =>
  BackupFileName.create(new Date(Now.getTime() - days * Day));

describe('BackupRetention (selectExpired)', () => {
  test('GIVEN backups older than the kept days WHEN selected THEN returns only those', () => {
    const retention = new BackupRetention({ days: 30 });
    const names = [daysAgo(0), daysAgo(29), daysAgo(31), daysAgo(90)];

    expect(retention.selectExpired(names, Now)).toEqual([
      daysAgo(31),
      daysAgo(90),
    ]);
  });

  test('GIVEN more backups than the kept copies WHEN selected THEN keeps the newest', () => {
    const retention = new BackupRetention({ days: 365, copies: 2 });
    const names = [daysAgo(3), daysAgo(1), daysAgo(2), daysAgo(0)];

    expect(retention.selectExpired(names, Now)).toEqual([
      daysAgo(2),
      daysAgo(3),
    ]);
  });

  test('GIVEN both limits WHEN selected THEN applies either', () => {
    const retention = new BackupRetention({ days: 5, copies: 3 });
    const names = [daysAgo(0), daysAgo(1), daysAgo(6), daysAgo(2), daysAgo(3)];

    expect(retention.selectExpired(names, Now)).toEqual([
      daysAgo(3),
      daysAgo(6),
    ]);
  });

  test('GIVEN other files on the remote WHEN selected THEN never picks them', () => {
    const retention = new BackupRetention({ days: 1, copies: 1 });
    const names = ['notes.txt', 'cert-it-old.zip', daysAgo(0), daysAgo(10)];

    expect(retention.selectExpired(names, Now)).toEqual([daysAgo(10)]);
  });
});
