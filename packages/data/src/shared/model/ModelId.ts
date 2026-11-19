import type { Identifiable } from '@cert-it/shared';

/** The ID type of the given model. */
export type ModelId<Model extends Identifiable> = Model['id'];
