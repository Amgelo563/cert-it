import { describe, expect, test } from 'vite-plus/test';
import { AccelFileServer } from '../../../../src/certificate/file/AccelFileServer';
import { SiteUrl } from '../../../../src/http/url/SiteUrl';
import {
  ContractFile,
  fileServerContract,
} from '../../contract/fileServerContract';

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
    const response = await createServer(baseUrl).serve(
      new Request('https://certs.example.org/c/ABCD-EFGH-JK/pdf', {
        headers: { Range: 'bytes=0-9' },
      }),
      { ...ContractFile, download: false },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('x-accel-redirect')).toBe(
      `${prefix}/7/ABCD-EFGH-JK.pdf`,
    );
    expect(response.body).toBeNull();
  });
});
