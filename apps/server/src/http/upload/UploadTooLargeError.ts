import { TaggedError } from 'better-result';

/** An error for an upload over the size limit. */
export class UploadTooLargeError extends TaggedError('UploadTooLargeError')<{
  maxBytes: number;
  message: string;
}> {
  constructor(args: { maxBytes: number }) {
    super({ ...args, message: `The upload is over ${args.maxBytes} bytes.` });
  }
}
