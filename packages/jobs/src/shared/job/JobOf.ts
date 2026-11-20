import type { Job } from './Job';

/** A job whose payload depends on its type, built from a union of `{ type, payload }` pairs. */
export type JobOf<
  Task extends { readonly type: string; readonly payload: unknown },
> = Omit<Job, 'type' | 'payload'> & Task;
