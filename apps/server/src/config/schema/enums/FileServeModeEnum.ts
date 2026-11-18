export const FileServeModeEnum = {
  Stream: 'stream',
  Accel: 'accel',
} as const;

/** A way certificate PDFs are delivered: sent by the app, or by nginx through X-Accel-Redirect. */
export type FileServeMode =
  (typeof FileServeModeEnum)[keyof typeof FileServeModeEnum];
