# @cert-it/hono

Small helpers for [Hono](https://hono.dev) apps, not tied to any one project.

- `clientIp/`: `ClientIpResolver` finds the visitor's real IP, even when the app runs behind nginx or another proxy.
- `csrf/`: `CsrfGuard` blocks form posts and API writes that come from other websites.
- `rateLimit/`: `RateLimiter` limits how often someone can do something, such as trying to log in.
- `json/`: `parseJson` reads and validates a JSON request body.
- `file/`: `FileStreamer` sends a file from disk, including just part of it when the browser asks for a part.
- `compression/` and `revalidation/`: `ResponseCompressor` gzips responses, and `ResponseRevalidator` lets the browser
  reuse a page it already has.
- `url/`: `SiteUrl` holds the app's public address.

`hono` is a peer dependency, so the app picks its version.

## Usage

### 1. Site URL

Give `SiteUrl` the address people use to reach the app. It can include a path, if the app lives under one.

```ts
import { SiteUrl } from '@cert-it/hono';

const siteUrl = new SiteUrl({ baseUrl: 'https://example.org/app' });

siteUrl.getBasePath(); // '/app'
siteUrl.path('/login'); // '/app/login'
siteUrl.url('/login'); // 'https://example.org/app/login'
siteUrl.getOrigin(); // 'https://example.org'
siteUrl.isSecure(); // true

const app = new Hono().basePath(siteUrl.getBasePath());
```

### 2. Middlewares

```ts
import {
  type ClientIpEnv,
  ClientIpResolver,
  CsrfGuard,
  ResponseCompressor,
  ResponseRevalidator,
} from '@cert-it/hono';
import { getConnInfo } from '@hono/node-server/conninfo';

type AppEnv = ClientIpEnv & { Variables: { user: User } };

const clientIps = new ClientIpResolver({
  trustedProxies: ['127.0.0.0/8', '::1/128'],
  getConnInfo, // from your runtime's adapter
});

const csrf = new CsrfGuard({
  origin: siteUrl.getOrigin(),
  onReject: (c) => c.json({ error: 'cross_origin' }, 403), // default: plain 403
});

const app = new Hono<AppEnv>();

app.use(
  clientIps.middleware(),
  new ResponseCompressor().middleware(),
  new ResponseRevalidator().middleware(),
);
app.use('/api/*', csrf.middleware());

app.get('/whoami', (c) => c.text(c.get('clientIp')));
```

`ClientIpResolver` puts the visitor's IP in `c.get('clientIp')`. When the app runs behind a proxy, every request seems
to come from the proxy, so the proxy passes the real IP in the `X-Real-IP` or `X-Forwarded-For` header. Anyone can send
those headers, though, so the resolver only reads them on requests from the addresses in `trustedProxies`.

`CsrfGuard` stops another website from making a logged-in visitor's browser send requests to your app. Reading requests
(`GET`, `HEAD`, `OPTIONS`) always go through. Other requests must come from your own site: the browser's `Origin` header
has to match `origin`, or, when a browser leaves `Origin` out, `Sec-Fetch-Site` has to be `same-origin`. Take `origin` from your config, not from the request's headers.

`ResponseCompressor` gzips pages and JSON larger than 1 KB (change it with `minBytes`).

`ResponseRevalidator` tags each page with an ETag, a fingerprint of its content. When the browser asks for a page it
already has and nothing changed, the app answers `304` and the browser reuses its copy. Pages sent with `no-store` or
`immutable` aren't tagged.

Neither touches file downloads. Compressing a file would break requests for part of it, and tagging it would load the
whole file into memory. A response counts as a file when it has `Accept-Ranges: bytes`, `Content-Range`,
`Content-Disposition`, `X-Accel-Redirect` or `X-Sendfile`. To leave out other responses, pass `skip`:

```ts
new ResponseCompressor({
  skip: (response) => response.headers.has('X-No-Compression'),
});
```

Add the compressor before the revalidator, so the fingerprint is taken before compression.

### 3. Rate limiting

`RateLimiter` counts attempts per key (an IP, an email) over a period of time. It's a plain object you call from your
route, so one route can check several keys:

```ts
import { RateLimiter } from '@cert-it/hono';

const ipLimiter = new RateLimiter({ maxHits: 10, windowMs: 15 * 60 * 1000 });
const emailLimiter = new RateLimiter({ maxHits: 10, windowMs: 15 * 60 * 1000 });

app.post('/login', async (c) => {
  const waitSeconds = Math.max(
    ipLimiter.hit(c.get('clientIp')),
    emailLimiter.hit(email),
  );
  if (waitSeconds > 0) {
    c.header('Retry-After', String(waitSeconds));
    return c.json({ error: 'too_many_attempts' }, 429);
  }

  // ...
  emailLimiter.reset(email); // after a successful login
});
```

`hit` records an attempt and returns `0`, or, if the key used up its attempts, how many seconds to wait. Blocked attempts
aren't counted. Old attempts are forgotten as they expire, so the limiter doesn't keep growing.

### 4. JSON bodies

`parseJson` returns the body checked by your schema, or `null` if it isn't valid JSON or doesn't match. It works with
Zod and any other library that supports [Standard Schema](https://standardschema.dev).

```ts
import { parseJson } from '@cert-it/hono';
import { email, strictObject, string } from 'zod';

const LoginSchema = strictObject({ email: email(), password: string() });

app.post('/login', async (c) => {
  const body = await parseJson(c, LoginSchema);
  if (!body) return c.json({ error: 'invalid_request' }, 400);

  body.email; // string
});
```

To limit how large a body can be, add Hono's `bodyLimit` middleware.

### 5. Files

`FileStreamer.send` answers with a file from disk, using the headers you pass. Browsers sometimes ask for only part of a
file with a `Range` header, for example a PDF viewer loading one page at a time. `send` handles that:

- No `Range`: the whole file, with `200`.
- One range inside the file: that part, with `206`.
- A range past the end of the file: `416`.
- Several ranges, or a header it can't read: the whole file.
- A `HEAD` request: the headers only.

```ts
import { FileStreamer } from '@cert-it/hono';
import { DoesntExistFileError } from '@cert-it/shared';

app.get('/files/:name', async (c) => {
  const result = await FileStreamer.Instance.send(
    c,
    pathFor(c.req.param('name')),
    {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="report.pdf"',
    },
  );

  if (result.isOk()) return result.value;
  if (DoesntExistFileError.is(result.error)) return c.notFound();
  throw result.error.cause; // FileSystemError
});
```

If the file is replaced while it's being sent, the browser still gets the old file in full, never half of each.

### 6. Handling errors

`send` doesn't throw. It returns one of two errors from `@cert-it/shared`:

- `DoesntExistFileError`: there's no file at that path, or it's a folder.
- `FileSystemError`: the file couldn't be opened for another reason. The original error is in `cause`.

If reading fails after the response has started, the download is cut off, since the response can no longer change.

```ts
result.error.match({
  DoesntExistFileError: () => c.notFound(),
  FileSystemError: (error) => c.text(error.message, 500),
});
```
