import { describe, expect, test } from 'vite-plus/test';
import { isFileResponse } from '../../../src/util/isFileResponse';

function response(headers: Record<string, string>): Response {
  return new Response(null, { headers });
}

describe('isFileResponse', () => {
  test.each<Record<string, string>>([
    { 'Accept-Ranges': 'bytes' },
    { 'Accept-Ranges': ' Bytes ' },
    { 'Content-Range': 'bytes 0-1/10' },
    { 'Content-Disposition': 'inline; filename="a.pdf"' },
    { 'X-Accel-Redirect': '/_files/a.pdf' },
    { 'X-Sendfile': '/srv/a.pdf' },
  ])('GIVEN the headers %o WHEN checking THEN returns true', (headers) => {
    expect(isFileResponse(response(headers))).toBe(true);
  });

  test.each<Record<string, string>>([
    {},
    { 'Accept-Ranges': 'none' },
    { 'Content-Type': 'text/html' },
  ])('GIVEN the headers %o WHEN checking THEN returns false', (headers) => {
    expect(isFileResponse(response(headers))).toBe(false);
  });
});
