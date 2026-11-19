import type { Brand } from '@cert-it/shared';

export type ItemId = Brand<number, 'ItemId'>;

export type Item = {
  readonly id: ItemId;
  readonly name: string;
  readonly slug: string;
  readonly groupId: number;
  readonly position: number;
};
