# 📑 cert-it

An app for issuing, hosting and verifying PDF certificates for courses and events, built and tested to be as lightweight as possible.

Staff upload a base PDF per course, place dynamic fields visually, import participants and issue certificates in bulk.

Each certificate gets a short, non-guessable code and a public page reached by its QR code, where anyone can check that
it's valid, download the PDF or add it to LinkedIn.

## 💫 Features

### Courses and participants

- Courses with their own language and date format, and a switch for the public lookup.
- Participants added by hand or imported from CSV, with column mapping, a preview of errors and duplicates, and skip/update modes.

### Templates and fonts

- Visual editor ([pdfme Designer](https://pdfme.com/)) for name, date and QR fields, with font, size, color, alignment and auto-shrink for long names.
- Live preview with sample data or a real participant.
- Versioned templates: saving creates a new version, and certificates already issued can be regenerated onto it with the same codes.
- Fonts uploaded or imported from Google Fonts or Fontsource, stored locally. A missing-glyph check (accents, ñ) runs in the editor and before issuing.

### Certificates

- Issue one, a selection, or everyone without a certificate, as a background job with progress.
- Edit and regenerate, revoke with a reason and reinstate, or permanently delete (admins only).
- Download a course's certificates as a ZIP, or export their codes and URLs as CSV.

### Public pages

- A page per certificate (`/c/{code}`) showing the name, course, date and a clear Valid/Revoked status, with a preview, a download button, an "Add to LinkedIn" link and Open Graph tags.
- A "Find my certificate" lookup by email and course, rate-limited and with a neutral answer when nothing matches.
- Spanish and English, accessible, and working under a strict CSP.

### Administration

- Admin, Editor and Viewer roles, checked on the server for every action.
- Rate-limited login, and an audit log of every change.
- Scheduled backups to any rclone remote (S3, Google Drive, Dropbox, etc.) with retention.

## 🚀 Deployment

You need a Linux server with Docker (with Compose) and an nginx that already handles TLS for your domain. cert-it doesn't ship its own nginx.

### 1. Create the app directory

```bash
sudo mkdir -p /srv/cert-it/data
cd /srv/cert-it
cp <repo>/deploy/docker-compose.yml <repo>/config.example.yml .
mv config.example.yml config.yml
sudo chown -R 1000:1000 data   # the container's user, change if yours is different
```

### 2. Edit `config.yml`

A minimal config looks like this:

```yaml
site:
  base_url: https://certs.example.org
  org_name: 'Example Org'
admin:
  email: admin@example.org # the first Admin account email, whose password is created and logged on first start
```

The [`config.example.yml`](config.example.yml) lists every option with its default and what it does: language, LinkedIn, favicon, link previews (Open Graph and Discord), PDF delivery, upload limits, font catalog, rate limits and backups.

### 3. Start the app

```bash
docker compose up -d
docker compose logs app        # the first Admin's password is printed once, here
curl http://127.0.0.1:3000/healthz
```

The app listens on `127.0.0.1:3000` only. If you set a path in `base_url`, the health check is at `<path>/healthz` instead.

### 4. Add the nginx config

Pick the variant that matches your `base_url`. Afterward, reload nginx:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

#### Own host (eg `certs.example.org`)

1. Copy `deploy/nginx/host.conf` into nginx's `conf.d/`
2. Set `server_name` and TLS as you do for your other sites.
3. Optionally, to let nginx send the PDFs, set `files.serve: accel`, point the `_files` alias at `/srv/cert-it/data/certificates/` and give nginx's user read access to that folder only.

#### Path on an existing site (eg `example.org/certs/`)

Paste the two `location` blocks from `deploy/nginx/path.conf` into that site's `server { … }`. The second block gives the admin panel the CSP its template editor needs.

### 5. Sign in

Open `{base_url}/admin/`, sign in with `admin.email` and the password from step 3, and set a new password. Then create accounts for your staff under Users.

### 6. Set up backups (optional)

Add your rclone remotes to `rclone.conf` next to `config.yml`, fill in the `backup` section of `config.yml` (schedule, retention, remotes) and restart with `docker compose up -d`.

## 💻 Development

Requires Node 24 and pnpm 12.

```bash
pnpm install      # install dependencies and the Git hooks
pnpm check        # format, lint and type check
pnpm fix          # fix formatting and lint issues
pnpm test         # run every package's tests
pnpm build        # build all packages
```
