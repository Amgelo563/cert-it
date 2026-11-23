import { describe, expect, test } from 'vite-plus/test';
import { BackupFileName } from '../../../../src/backup/archive/BackupFileName';

describe('BackupFileName (parse)', () => {
  test('GIVEN a created name WHEN parsed THEN returns its time', () => {
    const date = new Date('2026-11-23T03:00:00Z');
    const name = BackupFileName.create(date);

    expect(name).toBe('cert-it-20261123T030000Z.zip');
    expect(BackupFileName.parse(name)).toEqual(date);
  });

  test.each(['cert-it.zip', 'cert-it-20261123T030000Z.zip.tmp', 'notes.txt'])(
    'GIVEN %s WHEN parsed THEN is null',
    (name) => {
      expect(BackupFileName.parse(name)).toBeNull();
    },
  );
});
