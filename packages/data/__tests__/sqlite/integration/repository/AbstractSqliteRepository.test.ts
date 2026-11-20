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

describe('AbstractSqliteRepository (toDuplicateErrorOrThrow)', () => {
  test('GIVEN a subclass query with raw sql WHEN it repeats a unique value THEN returns a DuplicateModelError', () => {
    createItem('a', 1);
    const second = createItem('b', 2);

    const result = items.renameSlugWithRawSql(second.id, 'a');

    expect(result.isErr() && result.error.isOn('slug')).toBe(true);
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

describe('AbstractSqliteRepository (findByIds)', () => {
  test('GIVEN existing and missing IDs WHEN finding them THEN returns the existing ones ordered by ID', () => {
    const first = createItem('a', 1);
    const second = createItem('b', 2);

    const found = items.findByIds([second.id, MissingId, first.id]);

    expect(found).toEqual([first, second]);
  });

  test('GIVEN no IDs WHEN finding them THEN returns an empty array', () => {
    createItem('a', 1);

    expect(items.findByIds([])).toEqual([]);
  });
});

describe('AbstractSqliteRepository (findOne)', () => {
  test('GIVEN a matching item WHEN finding one THEN returns it', () => {
    createItem('a', 1);
    const created = createItem('b', 2);

    expect(items.findBySlug('b')).toEqual(created);
  });

  test('GIVEN no matching item WHEN finding one THEN returns null', () => {
    expect(items.findBySlug('missing')).toBeNull();
  });

  test('GIVEN several matches and an order WHEN finding one THEN returns the first in that order', () => {
    createItem('a', 1);
    const last = createItem('c', 3);
    createItem('b', 2);

    expect(items.findLastInGroup(1)).toEqual(last);
  });
});

describe('AbstractSqliteRepository (findMany)', () => {
  test('GIVEN no filter WHEN finding many THEN returns every item ordered by ID', () => {
    createItem('b', 2);
    createItem('a', 1);

    expect(items.listAll().map((item) => item.slug)).toEqual(['b', 'a']);
  });

  test('GIVEN a filter and an order WHEN finding many THEN returns the matches in that order', () => {
    createItem('c', 3);
    createItem('a', 1);
    createItem('other', 1, 2);

    expect(items.listAllByGroup(1).map((item) => item.slug)).toEqual([
      'a',
      'c',
    ]);
  });
});

describe('AbstractSqliteRepository (count)', () => {
  test('GIVEN items in two groups WHEN counting THEN counts all or only the filtered ones', () => {
    createItem('a', 1);
    createItem('b', 2);
    createItem('other', 1, 2);

    expect(items.countAll()).toBe(3);
    expect(items.countByGroup(1)).toBe(2);
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
