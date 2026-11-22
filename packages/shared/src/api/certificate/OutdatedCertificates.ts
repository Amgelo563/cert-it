import type { OutdatedCertificate } from './OutdatedCertificate';

/** The certificates of a course on an older template version, sorted by participant name. */
export type OutdatedCertificates = {
  /** Number of the course's latest template version, or null without a template. */
  readonly latestVersion: number | null;
  readonly items: readonly OutdatedCertificate[];
};
