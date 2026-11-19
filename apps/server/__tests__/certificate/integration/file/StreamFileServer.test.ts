import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, test } from 'vite-plus/test';
import type { CertificateCode } from '../../../../src/certificate/code/CertificateCode';
import { CertificateFileNotFoundError } from '../../../../src/certificate/file/errors/CertificateFileNotFoundError';
import { StreamFileServer } from '../../../../src/certificate/file/StreamFileServer';
import { DataDirectoryService } from '../../../../src/storage/DataDirectoryService';
import {
  ContractFile,
  fileServerContract,
} from '../../contract/fileServerContract';

const Content = '0123456789';

let parent: string;
let dataDirectory: DataDirectoryService;

beforeAll(async () => {
  parent = mkdtempSync(join(tmpdir(), 'cert-it-files-'));
  dataDirectory = new DataDirectoryService({ root: parent });
  await dataDirectory.writeFile(
    dataDirectory.getCertificatePath(ContractFile.courseId, ContractFile.code),
    Content,
  );
});

afterAll(() => {
  rmSync(parent, { recursive: true, force: true });
});

function serve(
  headers: Record<string, string> = {},
  method = 'GET',
): Promise<Response> {
  return new StreamFileServer({ dataDirectory }).serve(
    new Request('https://certs.example.org/c/ABCD-EFGH-JK/pdf', {
      method,
      headers,
    }),
    { ...ContractFile, download: false },
  );
}

describe('StreamFileServer (contract)', () => {
  fileServerContract(() => new StreamFileServer({ dataDirectory }));
});

describe('StreamFileServer (whole file)', () => {
  test('GIVEN no Range WHEN serving THEN sends the whole file and advertises ranges', async () => {
    const response = await serve();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-length')).toBe('10');
    expect(response.headers.get('accept-ranges')).toBe('bytes');
    expect(await response.text()).toBe(Content);
  });

  test('GIVEN a HEAD request with a Range WHEN serving THEN ignores the range and sends no body', async () => {
    const response = await serve({ Range: 'bytes=0-1' }, 'HEAD');

    expect(response.status).toBe(200);
    expect(response.headers.get('content-length')).toBe('10');
    expect(response.body).toBeNull();
  });

  test('GIVEN a missing file WHEN serving THEN throws CertificateFileNotFoundError', async () => {
    const server = new StreamFileServer({ dataDirectory });

    await expect(
      server.serve(new Request('https://certs.example.org/'), {
        ...ContractFile,
        code: 'MISS-INGF-IL' as CertificateCode,
        download: false,
      }),
    ).rejects.toThrow(CertificateFileNotFoundError);
  });
});

describe('StreamFileServer (Range)', () => {
  test.each([
    { range: 'bytes=2-5', contentRange: 'bytes 2-5/10', body: '2345' },
    { range: 'bytes=7-', contentRange: 'bytes 7-9/10', body: '789' },
    { range: 'bytes=-3', contentRange: 'bytes 7-9/10', body: '789' },
    { range: 'bytes=-50', contentRange: 'bytes 0-9/10', body: Content },
    { range: 'bytes=8-99', contentRange: 'bytes 8-9/10', body: '89' },
  ])(
    'GIVEN Range $range WHEN serving THEN sends 206 with $contentRange',
    async ({ range, contentRange, body }) => {
      const response = await serve({ Range: range });

      expect(response.status).toBe(206);
      expect(response.headers.get('content-range')).toBe(contentRange);
      expect(response.headers.get('content-length')).toBe(String(body.length));
      expect(await response.text()).toBe(body);
    },
  );

  test.each(['bytes=10-', 'bytes=10-20', 'bytes=-0'])(
    'GIVEN Range %s past the end WHEN serving THEN sends 416 with the size',
    async (range) => {
      const response = await serve({ Range: range });

      expect(response.status).toBe(416);
      expect(response.headers.get('content-range')).toBe('bytes */10');
    },
  );

  test.each(['bytes=0-1,4-5', 'bytes=5-2', 'items=0-1', 'bytes=-', 'nonsense'])(
    'GIVEN Range %s it does not support WHEN serving THEN sends the whole file',
    async (range) => {
      const response = await serve({ Range: range });

      expect(response.status).toBe(200);
      expect(await response.text()).toBe(Content);
    },
  );
});
