import { type DoesntExistFileError } from './generic/DoesntExistFileError.js';
import { type SyntaxFileReadError } from './read/SyntaxFileReadError.js';
import { type AlreadyExistsFileWriteError } from './write/AlreadyExistsFileWriteError.js';
import { type SerializationFileWriteError } from './write/SerializationFileWriteError.js';
import type { FileSystemError } from './generic/FileSystemError.ts';

/** A union of all errors triggered while writing a file */
export type FileWriteError =
  | AlreadyExistsFileWriteError
  | SerializationFileWriteError
  | FileSystemError;

/** A union of all errors triggered while reading a file */
export type FileReadError =
  | SyntaxFileReadError
  | DoesntExistFileError
  | FileSystemError;

/** A union of all errors triggered while reading or writing a file */
export type FileIOError = FileWriteError | FileReadError;
