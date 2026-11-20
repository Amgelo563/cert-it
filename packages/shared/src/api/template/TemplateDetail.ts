import type { FontSummary } from '../font/FontSummary';
import type { TemplateContent } from './SaveTemplateRequest';

/** A template version, as the template routes return it, with what the Designer needs to load it. */
export type TemplateDetail = {
  readonly id: number;
  readonly courseId: number;
  /** Version number within the course, starting at 1. */
  readonly version: number;
  readonly template: TemplateContent;
  /** SHA-256 of the base PDF, whose bytes are at `/api/courses/{courseId}/template/base-pdf/{sha256}`. */
  readonly basePdf: string;
  /** The fonts its text fields use. */
  readonly fonts: readonly FontSummary[];
  /** ISO 8601 date and time. */
  readonly createdAt: string;
};
