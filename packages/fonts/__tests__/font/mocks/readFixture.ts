import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Returns the bytes of a font in the fixtures folder. Each is cut down to printable ASCII plus `é`. */
export function readFixture(name: string): Uint8Array {
  return new Uint8Array(
    readFileSync(join(import.meta.dirname, '..', 'fixtures', name)),
  );
}
