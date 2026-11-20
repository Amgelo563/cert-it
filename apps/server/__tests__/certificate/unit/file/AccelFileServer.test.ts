import { SiteUrl } from '@cert-it/hono';
import { describe, expect, test } from 'vite-plus/test';
import { AccelFileServer } from '../../../../src/certificate/file/AccelFileServer';
import {
  ContractFile,
  fileServerContract,
} from '../../contract/fileServerContract';
import { serveFile } from '../../mocks/serveFile';

function createServer(baseUrl = 'https://certs.example.org'): AccelFileServer {
  return new AccelFileServer({ siteUrl: new SiteUrl({ baseUrl }) });
}

describe('AccelFileServer (contract)', () => {
  fileServerContract(() => createServer());
});

describe.each([
  { baseUrl: 'https://certs.example.org', prefix: '/_files' },
  { baseUrl: 'https://example.org/certs', prefix: '/certs/_files' },
])('AccelFileServer ($baseUrl)', ({ baseUrl, prefix }) => {
  test('GIVEN a file WHEN serving it THEN redirects nginx to its internal location under the base path, with no body', async () => {
    const response = (
      await serveFile(
        createServer(baseUrl),
        { ...ContractFile, download: false },
        { headers: { Range: 'bytes=0-9' } },
      )
    ).unwrap();

    expect(response.status).toBe(200);
    expect(response.headers.get('x-accel-redirect')).toBe(
      `${prefix}/7/ABCD-EFGH-JK.pdf`,
    );
    expect(response.body).toBeNull();
  });
});
