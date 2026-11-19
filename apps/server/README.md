# @cert-it/server

Hono process that serves everything.

- **API** under `{base_path}/api/` for the admin panel.
- **Public pages** rendered with Hono JSX: the certificate page (`/c/{code}`) and the certificate lookup. They work under a strict CSP: no inline scripts or styles.
- **Admin panel files**: the built [`apps/admin`](../admin) SPA, served under `{base_path}/admin/` so nginx can give it its own CSP.
- **Certificate PDFs**: served after a status check, either streamed by the app or handed to nginx with `X-Accel-Redirect` (`files.serve`).
- **PDF generation** in a child process started on demand with a capped heap, which exits when no jobs are left.

All settings come from `config.yml`, which is validated at startup.

Every URL comes from `site.base_url`, so the same image works on its own host or under a path such as `/certs/`.

Data lives in SQLite (WAL mode, via Drizzle) and plain files under a single data directory.

## Layout

```
src/
  app/          # composition: Hono app, middleware wiring, startup
  generator/    # entry point of the PDF generator child process
  config/, database/, http/, auth/, course/, certificate/…   # one folder per feature
  error/        # errors shared by several features
  util/         # app-wide utilities
__tests__/      # mirrors the features: unit, integration, contract
drizzle/        # generated migrations
```

## Database

Each feature owns its model at its top level (`src/course/Course.ts`) and its Drizzle table and repository under `repository/`, built on [`@cert-it/data`](../../packages/data). `src/database/` lists every repository in `Repositories` and `DatabaseService` opens the database inside the data directory, applying pending migrations from `drizzle/` at startup. `src/index.ts` builds the services from the config, starts the data directory, database and HTTP services in that order, and stops them on SIGTERM/SIGINT.

After changing a `*Table.ts`, generate a migration and commit it with `drizzle/meta/`:

```bash
pnpm db:generate --name=add-something
```
