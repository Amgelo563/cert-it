export const JobTypeEnum = {
  Issue: 'issue',
  Regenerate: 'regenerate',
} as const;

/** What a background job does. */
export type JobType = (typeof JobTypeEnum)[keyof typeof JobTypeEnum];
