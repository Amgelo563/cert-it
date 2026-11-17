# @cert-it/admin

cert-it admin panel (Vite + React SPA), built to static files and served by [`apps/server`](../server) under `{base_path}/admin/`.

Staff use it to manage courses, participants, fonts, templates, certificates, users and the audit log.

What each user can see and do follows the permission matrix in [`@cert-it/shared`](../../packages/shared). The server enforces the same rules on every request.

- **UI:** [Mantine](https://mantine.dev/) 9, with a theme built from the shared theme values.
- **Template editor:** the [pdfme](https://pdfme.com/) Designer, limited to name, date and QR fields.
- **Client-side work:** CSV parsing (papaparse) and template previews run in the browser, which keeps the server's memory use low.
- **Base path:** built with relative asset paths. The server injects the real base path at runtime, so one build works at `/` or under a path.
- **Languages:** Spanish and English.

## Layout

```
src/
  app/        # router, layout, theme, API client
  auth/, user/, course/, template/…   # one folder per feature, same names as the server
__tests__/
```
