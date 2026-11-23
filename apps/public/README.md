# @cert-it/public

Browser code of the public pages, built with Vite to static files and served by [`apps/server`](../server) under `{base_path}/static/`.

The server renders the pages' HTML with Hono JSX. This app only adds their styles and the bits of script that need a browser:

- **Certificate page** (`/c/{code}`): draws a preview of the PDF with [pdf.js](https://mozilla.github.io/pdf.js/), with a skeleton while it loads and a link to the PDF if drawing fails, plus the copy link button.
- **Lookup page** (the base path): styles only, since the form works without JavaScript.

Each page is its own entry in `vite.config.ts`. The server reads the build's manifest to link each page's script and styles, so a page's entry name must match the one its server code asks for.

- **Strict CSP:** no inline scripts, styles or `style` attributes. Every rule lives in `src/style/public.css`, and pdf.js runs without WebAssembly, with its fallback decoders and standard fonts copied next to the build under `pdfjs/{version}/`.
- **Theme:** the shared theme values from [`@cert-it/shared`](../../packages/shared) become CSS custom properties, so the pages match the admin panel, in light and dark.
- **Files:** hashed names, served as immutable, with `.br` and `.gz` copies written at build time for the server to send as they are.
- **Base path:** built with relative asset paths, so one build works at `/` or under a path.

## Building

The server needs this build to start, so build it before running the server:

```bash
pnpm --filter @cert-it/public build
```

`pnpm dev` at the root builds it once, then keeps rebuilding it in watch mode. The dev server reads the manifest again on every page, so renamed files are picked up without a restart.
