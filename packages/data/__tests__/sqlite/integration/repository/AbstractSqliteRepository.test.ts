import { afterEach, beforeEach, describe, expect, test } from 'vite-plus/test';
import { DuplicateModelError } from '../../../../src/shared/errors/DuplicateModelError';
import { ModelNotFoundError } from '../../../../src/shared/errors/ModelNotFoundError';
import type { SqliteDatabase } from '../../../../src/sqlite/database/SqliteDatabase';
import {
  createItemDatabase,
  type ItemRepositories,
} from '../../mocks/createItemDatabase';
import type { ItemId } from '../../mocks/Item';
import type { SqliteItemRepository } from '../../mocks/SqliteItemRepository';

const MissingId = 999 as ItemId;

let database: SqliteDatabase<ItemRepositories>;
let items: SqliteItemRepository;

beforeEach(() => {
  database = createItemDatabase();
  items = database.getRepositories().items;
});

afterEach(() => {
  database.close();
});

function createItem(slug: string, position: number, groupId = 1) {
  return items
    .create({ name: slug.toUpperCase(), slug, groupId, position })
    .unwrap();
}

describe('AbstractSqliteRepository (findById)', () => {
  test('GIVEN a created item WHEN finding it by ID THEN returns it', () => {
    const created = createItem('a', 1);

    expect(items.findById(created.id)).toEqual(created);
  });

  test('GIVEN no item with the ID WHEN finding it THEN returns null', () => {
    expect(items.findById(MissingId)).toBeNull();
  });
});

describe('AbstractSqliteRepository (create)', () => {
  test('GIVEN valid values WHEN creating THEN returns the model with its ID', () => {
    const result = items.create({
      name: 'A',
      slug: 'a',
      groupId: 1,
      position: 1,
    });

    expect(result.unwrap()).toEqual({
      id: 1,
      name: 'A',
      slug: 'a',
      groupId: 1,
      position: 1,
    });
  });

  test('GIVEN an existing slug WHEN creating THEN returns a DuplicateModelError on slug', () => {
    createItem('a', 1);

    const result = items.create({
      name: 'B',
      slug: 'a',
      groupId: 1,
      position: 2,
    });

    expect(result.isErr()).toBe(true);
    const error = result.isErr() ? result.error : null;
    expect(DuplicateModelError.is(error)).toBe(true);
    expect(error?.model).toBe('items');
    expect(error?.isOn('slug')).toBe(true);
  });

  test('GIVEN an existing group and position WHEN creating THEN returns a DuplicateModelError on both fields', () => {
    createItem('a', 1);

    const result = items.create({
      name: 'B',
      slug: 'b',
      groupId: 1,
      position: 1,
    });

    const error = result.isErr() ? result.error : null;
    expect(error?.isOn('position', 'groupId')).toBe(true);
    expect(error?.isOn('groupId')).toBe(false);
  });

  test('GIVEN an existing ID WHEN creating with that ID THEN returns a DuplicateModelError on id', () => {
    const created = createItem('a', 1);

    const result = items.create({
      id: created.id,
      name: 'B',
      slug: 'b',
      groupId: 1,
      position: 2,
    });

    const error = result.isErr() ? result.error : null;
    expect(error?.isOn('id')).toBe(true);
  });

  test('GIVEN an error that is not a unique violation WHEN creating THEN throws', () => {
    expect(() =>
      items.create({
        name: null as unknown as string,
        slug: 'a',
        groupId: 1,
        position: 1,
      }),
    ).toThrow(/NOT NULL constraint failed/);
  });
});

describe('AbstractSqliteRepository (update)', () => {
  test('GIVEN an item WHEN updating some fields THEN returns it with only those changed', () => {
    const created = createItem('a', 1);

    const result = items.update(created.id, { name: 'Renamed' });

    expect(result.unwrap()).toEqual({ ...created, name: 'Renamed' });
    expect(items.findById(created.id)?.name).toBe('Renamed');
  });

  test('GIVEN no item with the ID WHEN updating THEN returns a ModelNotFoundError', () => {
    const result = items.update(MissingId, { name: 'Renamed' });

    const error = result.isErr() ? result.error : null;
    expect(ModelNotFoundError.is(error)).toBe(true);
    expect(error).toMatchObject({ model: 'items', id: MissingId });
  });

  test('GIVEN an item WHEN updating with no values THEN returns it unchanged', () => {
    const created = createItem('a', 1);

    expect(items.update(created.id, { name: undefined }).unwrap()).toEqual(
      created,
    );
  });

  test('GIVEN no item with the ID WHEN updating with no values THEN returns a ModelNotFoundError', () => {
    const result = items.update(MissingId, {});

    expect(result.isErr() && ModelNotFoundError.is(result.error)).toBe(true);
  });

  test('GIVEN two items WHEN updating one to the slug of the other THEN returns a DuplicateModelError', () => {
    createItem('a', 1);
    const second = createItem('b', 2);

    const result = items.update(second.id, { slug: 'a' });

    const error = result.isErr() ? result.error : null;
    expect(DuplicateModelError.is(error) && error.isOn('slug')).toBe(true);
  });
});

describe('AbstractSqliteRepository (delete)', () => {
  test('GIVEN an item WHEN deleting it THEN it no longer exists', () => {
    const created = createItem('a', 1);

    expect(items.delete(created.id).isOk()).toBe(true);
    expect(items.findById(created.id)).toBeNull();
  });

  test('GIVEN no item with the ID WHEN deleting THEN returns a ModelNotFoundError', () => {
    const result = items.delete(MissingId);

    expect(result.isErr() && ModelNotFoundError.is(result.error)).toBe(true);
  });
});

describe('AbstractSqliteRepository (findPage)', () => {
  test('GIVEN items in two groups WHEN listing a page of one group THEN returns that page in order with the group total', () => {
    createItem('c', 3);
    createItem('a', 1);
    createItem('other', 1, 2);
    createItem('b', 2);

    const page = items.listByGroup(1, { page: 2, size: 2 });

    expect(page.items.map((item) => item.slug)).toEqual(['c']);
    expect(page).toMatchObject({ total: 3, page: 2, size: 2 });
  });

  test('GIVEN no items WHEN listing THEN returns an empty page', () => {
    expect(items.listByGroup(1, { page: 1, size: 10 })).toEqual({
      items: [],
      total: 0,
      page: 1,
      size: 10,
    });
  });
});
