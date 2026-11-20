import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DoesntExistFileError } from '@cert-it/shared';
import { afterAll, beforeAll, describe, expect, test } from 'vite-plus/test';
import type { CertificateCode } from '../../../../src/certificate/code/CertificateCode';
import { StreamFileServer } from '../../../../src/certificate/file/StreamFileServer';
import { DataDirectoryService } from '../../../../src/storage/DataDirectoryService';
import {
  ContractFile,
  fileServerContract,
} from '../../contract/fileServerContract';
import { serveFile } from '../../mocks/serveFile';

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

describe('StreamFileServer (contract)', () => {
  fileServerContract(() => new StreamFileServer({ dataDirectory }));
});

describe('StreamFileServer (serve)', () => {
  test('GIVEN a certificate WHEN serving THEN streams its PDF from the data directory with ranges', async () => {
    const response = (
      await serveFile(
        new StreamFileServer({ dataDirectory }),
        { ...ContractFile, download: false },
        { headers: { Range: 'bytes=2-5' } },
      )
    ).unwrap();

    expect(response.status).toBe(206);
    expect(await response.text()).toBe('2345');
  });

  test('GIVEN a missing file WHEN serving THEN returns a DoesntExistFileError', async () => {
    const result = await serveFile(new StreamFileServer({ dataDirectory }), {
      ...ContractFile,
      code: 'MISS-INGF-IL' as CertificateCode,
      download: false,
    });

    expect(result.isErr() && DoesntExistFileError.is(result.error)).toBe(true);
  });
});
