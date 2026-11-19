import { expect, test } from 'vite-plus/test';
import type { CertificateCode } from '../../../src/certificate/code/CertificateCode';
import type { FileServer } from '../../../src/certificate/file/FileServer';
import type { CourseId } from '../../../src/course/Course';

/** Certificate every factory's server must be able to serve. */
export const ContractFile = {
  courseId: 7 as CourseId,
  code: 'ABCD-EFGH-JK' as CertificateCode,
};

/** Checks the headers every {@link FileServer} sends, which nginx keeps through X-Accel-Redirect. */
export function fileServerContract(createServer: () => FileServer): void {
  const get = new Request('https://certs.example.org/c/ABCD-EFGH-JK/pdf');

  test('GIVEN a file WHEN serving it THEN sends it as a PDF that is revalidated on every use', async () => {
    const response = await createServer().serve(get, {
      ...ContractFile,
      download: false,
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/pdf');
    expect(response.headers.get('cache-control')).toBe('no-cache');
  });

  test('GIVEN a file WHEN serving it for viewing THEN sends it inline', async () => {
    const response = await createServer().serve(get, {
      ...ContractFile,
      download: false,
    });

    expect(response.headers.get('content-disposition')).toBe(
      'inline; filename="certificate-ABCD-EFGH-JK.pdf"',
    );
  });

  test('GIVEN a file WHEN serving it for download THEN sends it as an attachment', async () => {
    const response = await createServer().serve(get, {
      ...ContractFile,
      download: true,
    });

    expect(response.headers.get('content-disposition')).toBe(
      'attachment; filename="certificate-ABCD-EFGH-JK.pdf"',
    );
  });
}
