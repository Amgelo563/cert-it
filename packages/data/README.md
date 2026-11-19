# @cert-it/data

Project-agnostic data layer, using Drizzle and better-sqlite3.

- `shared/`: backend-agnostic contracts (`UnitOfWork`, `Page`, `PageRequest`, `ModelId`, `ModelNotFoundError`, `DuplicateModelError`).
- `sqlite/`: `SqliteDatabase`, `SqliteUnitOfWork` and `AbstractSqliteRepository`.

`Identifiable` and `Brand` come from `@cert-it/shared`.

## Usage

### 1. Model and table

The model is a plain type with a branded ID. The table is a normal Drizzle table with an `id` primary key.

```ts
// author/model/Author.ts
import type { Brand } from '@cert-it/shared';

export type AuthorId = Brand<number, 'AuthorId'>;

export type Author = {
  readonly id: AuthorId;
  readonly name: string;
  readonly email: string;
  /** Whether the author hasn't been deactivated. */
  readonly active: boolean;
};

// author/repository/authorTable.ts
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const authorTable = sqliteTable('authors', {
  id: integer('id').primaryKey({ autoIncrement: true }).$type<AuthorId>(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  deactivatedAt: integer('deactivated_at', { mode: 'timestamp' }),
});
```

Brand every column that holds a branded value with `$type`, like the ID, foreign keys, and special values like a normalized email.

Use Drizzle's column modes (`json`, `timestamp`, `boolean`) for conversions, so rows already hold `Date`s, objects and booleans.

### 2. Repository

Consumers only see the interface, which lists just the operations the table supports, with the input types they may pass.

```ts
// author/repository/AuthorRepository.ts
import type {
  DuplicateModelError,
  ModelNotFoundError,
  Page,
  PageRequest,
} from '@cert-it/data';
import type { Result } from 'better-result';

/** An object that stores and queries authors. */
export interface AuthorRepository {
  /** Returns the author with the given ID, or null if there's none. */
  findById(id: AuthorId): Author | null;

  /** Creates an author, unless one already has that email. */
  create(data: {
    name: string;
    email: string;
  }): Result<Author, DuplicateModelError>;

  /** Updates the given fields of an author. */
  update(
    id: AuthorId,
    data: { name?: string },
  ): Result<Author, ModelNotFoundError | DuplicateModelError>;

  /** Returns a page of authors whose name contains the given text. */
  search(text: string, page: PageRequest): Page<Author>;
}
```

Extend `AbstractSqliteRepository`, which provides `findById`, `create`, `update` and `delete`. You'll need to implement `toModel` and any extra methods (`search` in this example).

```ts
// author/repository/SqliteAuthorRepository.ts
import {
  AbstractSqliteRepository,
  type Page,
  type PageRequest,
} from '@cert-it/data';
import { like } from 'drizzle-orm';

export class SqliteAuthorRepository
  extends AbstractSqliteRepository<Author, typeof authorTable>
  implements AuthorRepository
{
  protected readonly table = authorTable;

  public search(text: string, page: PageRequest): Page<Author> {
    return this.findPage(page, {
      where: like(authorTable.name, `%${text}%`),
      orderBy: [authorTable.name],
    });
  }

  // For this example, we derive `active` and hide the column it comes from
  protected toModel(row: typeof authorTable.$inferSelect): Author {
    const { deactivatedAt, ...author } = row;
    return { ...author, active: deactivatedAt === null };
  }
}
```

If the model matches the row, `toModel` can be `return row;`. It only needs a real body for what columns can't express,
like the derived `active` above, columns the model leaves out (eg. a password hash), or regrouping columns into one field.

### 3. Database

List the repositories in one type, and give `SqliteDatabase` a function that creates them for a database or a transaction.

```ts
// database/Repositories.ts
export type Repositories = {
  authors: AuthorRepository;
  books: BookRepository;
};

// app startup
import { SqliteDatabase } from '@cert-it/data';

const database = SqliteDatabase.create<Repositories>({
  path: 'data/app.db',
  migrationsFolder: 'drizzle',
  createRepositories: (db) => ({
    authors: new SqliteAuthorRepository({ db }),
    books: new SqliteBookRepository({ db }),
  }),
});

const { authors } = database.getRepositories();

const result = authors.create({ name: 'Ada', email: 'ada@example.org' });
if (result.isErr() && result.error.isOn('email')) {
  // an author with that email already exists
}

const page = authors.search('Ada', { page: 1, size: 20 });
```

### 4. Transaction

`UnitOfWork.transaction` runs the work in one transaction, with repositories bound to it. It rolls back when the work
returns an `Err` or throws, so either every write is saved or none is.

```ts
import type { DuplicateModelError, UnitOfWork } from '@cert-it/data';
import type { Result } from 'better-result';

type AuthorPublisherOptions = { unitOfWork: UnitOfWork<Repositories> };

/** An object that registers authors together with their first book. */
export class AuthorPublisher {
  protected readonly unitOfWork: UnitOfWork<Repositories>;

  constructor(options: AuthorPublisherOptions) {
    this.unitOfWork = options.unitOfWork;
  }

  /** Creates an author and their first book, or neither if either fails. */
  public publish(options: {
    name: string;
    email: string;
    bookTitle: string;
  }): Result<Book, DuplicateModelError> {
    return this.unitOfWork.transaction(({ authors, books }) =>
      authors
        .create({ name: options.name, email: options.email })
        .andThen((author) =>
          books.create({ authorId: author.id, title: options.bookTitle }),
        ),
    );
  }
}

const publisher = new AuthorPublisher({ unitOfWork: database.getUnitOfWork() });
```

A transaction started inside another one only rolls back its own writes.

### 5. Handling Errors

Repositories return two `TaggedError`: `ModelNotFoundError` and `DuplicateModelError`, any other database error is thrown.

You can match them like this:

```ts
result.error.match({
  ModelNotFoundError: (error) => c.json({ error }, 404),
  DuplicateModelError: (error) => c.json({ error }, 409),
});
```
