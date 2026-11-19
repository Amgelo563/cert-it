import { Result } from 'better-result';
import { afterEach, beforeEach, describe, expect, test } from 'vite-plus/test';
import type { SqliteDatabase } from '../../../../src/sqlite/database/SqliteDatabase';
import {
  createItemDatabase,
  type ItemRepositories,
} from '../../mocks/createItemDatabase';

let database: SqliteDatabase<ItemRepositories>;

beforeEach(() => {
  database = createItemDatabase();
});

afterEach(() => {
  database.close();
});

function countItems(): number {
  return database.getRepositories().items.listByGroup(1, { page: 1, size: 10 })
    .total;
}

describe('SqliteUnitOfWork (transaction)', () => {
  test('GIVEN work that returns Ok WHEN running it THEN commits every write and returns the result', () => {
    const result = database
      .getUnitOfWork()
      .transaction(({ items }) =>
        items
          .create({ name: 'A', slug: 'a', groupId: 1, position: 1 })
          .andThen(() =>
            items.create({ name: 'B', slug: 'b', groupId: 1, position: 2 }),
          ),
      );

    expect(result.unwrap().slug).toBe('b');
    expect(countItems()).toBe(2);
  });

  test('GIVEN work that returns Err after a write WHEN running it THEN rolls back and returns the error', () => {
    const result = database
      .getUnitOfWork()
      .transaction(({ items }) =>
        items
          .create({ name: 'A', slug: 'a', groupId: 1, position: 1 })
          .andThen(() =>
            items.create({ name: 'B', slug: 'a', groupId: 1, position: 2 }),
          ),
      );

    expect(result.isErr() && result.error.isOn('slug')).toBe(true);
    expect(countItems()).toBe(0);
  });

  test('GIVEN work that throws after a write WHEN running it THEN rolls back and rethrows', () => {
    const failure = new Error('failure');

    expect(() =>
      database.getUnitOfWork().transaction(({ items }) => {
        items.create({ name: 'A', slug: 'a', groupId: 1, position: 1 });
        throw failure;
      }),
    ).toThrow(failure);
    expect(countItems()).toBe(0);
  });

  test('GIVEN a nested transaction that returns Err WHEN the outer one returns Ok THEN keeps only the outer writes', () => {
    const unitOfWork = database.getUnitOfWork();

    const result = unitOfWork.transaction(({ items }) => {
      items.create({ name: 'A', slug: 'a', groupId: 1, position: 1 });

      const inner = unitOfWork.transaction((nested) =>
        nested.items
          .create({ name: 'B', slug: 'b', groupId: 1, position: 2 })
          .andThen(() => Result.err('inner failure' as const)),
      );

      return Result.ok(inner.isErr());
    });

    expect(result.unwrap()).toBe(true);
    expect(countItems()).toBe(1);
  });
});
