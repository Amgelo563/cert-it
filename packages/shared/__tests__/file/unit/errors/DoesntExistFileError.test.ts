import { describe, expect, test } from 'vite-plus/test';
import { DoesntExistFileError } from '../../../../src/file/errors/generic/DoesntExistFileError';

function fsError(code: string): Error {
  return Object.assign(new Error(code), { code });
}

describe('DoesntExistFileError (matches)', () => {
  test.each(['ENOENT', 'ENOTDIR', 'EISDIR'])(
    'GIVEN a %s error WHEN matching THEN returns true',
    (code) => {
      expect(DoesntExistFileError.matches(fsError(code))).toBe(true);
    },
  );

  test('GIVEN another code WHEN matching THEN returns false', () => {
    expect(DoesntExistFileError.matches(fsError('EACCES'))).toBe(false);
  });

  test('GIVEN a value that is not an error WHEN matching THEN returns false', () => {
    expect(DoesntExistFileError.matches({ code: 'ENOENT' })).toBe(false);
  });
});
