import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Returns the bytes of a font in the fixtures folder. Each covers printable ASCII plus `é`. */
export function readFontFixture(name: string): Uint8Array {
  return new Uint8Array(
    readFileSync(join(import.meta.dirname, '..', 'fixtures', name)),
  );
}
