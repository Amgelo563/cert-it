# @cert-it/fonts

Project-agnostic font handling, using fontkit, for apps where people pick or upload their own fonts.

Rendering text and embedding fonts are left to your drawing library.

`@cert-it/fonts` has no Node imports, so it also works in the browser. `FontStore` writes to disk, so it has its own entry:

```ts
import { FontReader, GlyphChecker } from '@cert-it/fonts'; // browser or Node
import { FontStore } from '@cert-it/fonts/node'; // Node only
```

## Usage

### 1. Reading a font

`FontReader` returns a font's family and style, or why the file can't be used.

```ts
import { FontReader } from '@cert-it/fonts';

const result = FontReader.Instance.read(bytes);
if (result.isErr()) return c.json({ error: result.error.reason }, 400);

result.value; // { family: 'Roboto', style: 'Bold', extension: 'ttf', variable: false }
```

The extension comes from the file's first bytes, so a renamed file still gets the right one.

### 2. Checking characters

When a font lacks a character, libraries usually print a blank in its place without any error. Check names with
`GlyphChecker` before printing them:

```ts
import { GlyphChecker } from '@cert-it/fonts';

const checker = GlyphChecker.fromBytes(bytes).unwrap();

checker.findMissing('Nguyễn Żółć'); // ['ễ', 'Ż', 'ó', 'ł', 'ć'] for a font with only basic Latin
checker.covers('René'); // true
```

`findMissing` lists each missing character once, in the order it appears, and skips spaces and line breaks. Some
keyboards type an accent as a separate mark after its letter; the checker joins them first, since fonts have the
combined character.

A checker covers one font, so make one per font the text can be drawn in.

### 3. Finding fonts in a catalog

```ts
import { FontsourceFontCatalog, GoogleFontCatalog } from '@cert-it/fonts';

const catalog = new FontsourceFontCatalog({ maxBytes: 8 * 1024 * 1024 });
// or: new GoogleFontCatalog({ apiKey, maxBytes: 8 * 1024 * 1024 });

const families = (
  await catalog.search({ query: 'robo', category: 'serif' })
).unwrap();
// [{ id: 'roboto-slab', family: 'Roboto Slab', category: 'serif', variants: [...], subsets: [...], license: 'OFL-1.1' }]

const file = await catalog.download('roboto-slab', {
  weight: 400,
  italic: false,
});
```

Neither API can search by part of a name, so the catalog downloads the whole list of families on the first search,
keeps it for a day (`listTtlMs`), and searches it in memory.

`download` stops reading once the file passes `maxBytes`, and requests give up after `timeoutMs` (10 seconds by
default).

Google Fonts needs an API key, so keep the catalog on your server. Each of its files has every script the font
supports.

Fontsource splits each font into one file per script (`latin`, `latin-ext`, `vietnamese` and so on). `download` gets
the font's default one, usually `latin`, unless you pass `{ subset }`. Spanish names fit in `latin`, but Polish or
Vietnamese ones may not, so run the glyph check on the names you'll print.

### 4. Storing fonts

`FontStore` saves fonts in a folder as `<sha256>.<ext>`, so a font saved twice is kept once.

```ts
import { FontStore } from '@cert-it/fonts/node';

const store = FontStore.create({ directory: 'data/fonts' });
store.start(); // creates the folder and cleans up after interrupted saves

const result = await store.save(bytes);
result.value; // { family, style, extension, variable, sha256, fileName: '<sha256>.ttf' }

store.getPath(result.value.fileName); // the file's absolute path
await store.delete(result.value.fileName);
```

`save` reads the font first and refuses unusable ones. If the file is already there, it writes nothing and returns the
same details, so you can find your existing record by `sha256`. Files go to a temporary file and are then renamed, so a
crash can't leave half a font behind.

`getPath` and `delete` throw on names `save` couldn't have made (64 hex characters plus `.ttf` or `.otf`), which keeps
them inside the folder.

fontkit needs the whole file to read a font, so `save` takes bytes. Stream uploads to a temporary file first, then read
it, so the request body isn't held in memory.

### 5. Handling errors

Every error is returned as a `TaggedError`. Only `FontStore` throws: `start` when it can't create the folder, and
`getPath` or `delete` when given an invalid file name.

| Error                                 | From                      | When                                                                      |
| ------------------------------------- | ------------------------- | ------------------------------------------------------------------------- |
| `InvalidFontError`                    | reading, checking, saving | the file can't be used, see `reason`                                      |
| `FontCatalogUnavailableError`         | catalogs                  | no answer in time, an error status (in `status`), or an unexpected answer |
| `CatalogFontNotFoundError`            | `download`                | the family, variant or subset isn't in the catalog                        |
| `FontTooLargeError`                   | `download`                | the file is over `maxBytes`                                               |
| `FileSystemError` (`@cert-it/shared`) | `FontStore`               | the disk write or delete failed, with the original error in `cause`       |

You can match them like this:

```ts
result.error.match({
  CatalogFontNotFoundError: () => c.json({ error: 'not_found' }, 404),
  FontCatalogUnavailableError: () =>
    c.json({ error: 'catalog_unavailable' }, 502),
  FontTooLargeError: () => c.json({ error: 'too_large' }, 413),
});
```

Error messages leave out the request URL, which carries Google's API key.
