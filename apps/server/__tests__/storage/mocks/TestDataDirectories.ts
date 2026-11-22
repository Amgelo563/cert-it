import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { Certificate } from '../../../src/certificate/Certificate';
import { DataDirectoryService } from '../../../src/storage/DataDirectoryService';

/** Started data directories in the system's temp folder, removed together after each test. */
export class TestDataDirectories {
  protected readonly roots: string[] = [];

  /** Creates and starts a data directory in a new temp folder. */
  public create(): DataDirectoryService {
    const root = mkdtempSync(join(tmpdir(), 'cert-it-data-'));
    this.roots.push(root);
    const dataDirectory = new DataDirectoryService({ root });
    dataDirectory.start();
    return dataDirectory;
  }

  /** Writes a stand-in for the PDF the generator makes, returning its path. */
  public writePdf(
    dataDirectory: DataDirectoryService,
    certificate: Certificate,
  ): string {
    const path = dataDirectory.getCertificatePath(
      certificate.courseId,
      certificate.code,
    );
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, '%PDF-1.7');
    return path;
  }

  /** Removes every folder created since the last call. */
  public removeAll(): void {
    for (const root of this.roots.splice(0)) {
      rmSync(root, { recursive: true, force: true });
    }
  }
}
