# 📑 cert-it

An app for issuing, hosting and verifying PDF certificates for courses and events, built and tested to be as lightweight
as possible.

Staff upload a base PDF per course, place dynamic fields visually, import participants and issue certificates in bulk.

Each certificate gets a short, non-guessable code and a public page reached by its QR code, where anyone can check that
it's valid, download the PDF or add it to LinkedIn.

## 💫 Features

### Courses and participants

- Courses with their own language and date format, and a switch for the public lookup.
- Participants added by hand or imported from CSV, with column mapping, a preview of errors and duplicates, and
  skip/update modes.

### Templates and fonts

- Visual editor ([pdfme Designer](https://pdfme.com/)) for name, date and QR fields, with font, size, color, alignment
  and auto-shrink for long names.
- Live preview with sample data or a real participant.
- Versioned templates: saving creates a new version, and certificates already issued can be regenerated onto it with the
  same codes.
- Fonts uploaded or imported from Google Fonts or Fontsource, stored locally. A missing-glyph check (accents, ñ) runs in
  the editor and before issuing.

### Certificates

- Issue one, a selection, or everyone without a certificate, as a background job with progress.
- Edit and regenerate, revoke with a reason and reinstate, or permanently delete (admins only).
- Download a course's certificates as a ZIP, or export their codes and URLs as CSV.

### Verifiable credentials

- Every certificate is also an [Open Badges 3.0](https://www.imsglobal.org/spec/ob/v3p0) credential, signed by the
  issuer (RS256 VC-JWT), so anyone can check it with the issuer's public key without trusting the certificate page.
- Holders download it from the certificate page, and each PDF carries it as an attached file. The course ZIP includes it
  next to each PDF.
- Revoking, reinstating or deleting a certificate shows up for offline verifiers through a
  signed [Bitstring Status List](https://www.w3.org/TR/vc-bitstring-status-list/).
- The issuer profile (`/issuer`), its public key and the status list are served from `base_url`, so the credentials
  verify as long as that address keeps answering. See [Moving to a new address](#moving-to-a-new-address).

### Public pages

- A page per certificate (`/c/{code}`) showing the name, course, date and a clear Valid/Revoked status, with a preview,
  a download button for the PDF or the signed credential, an "Add to LinkedIn" link and Open Graph tags.
- A "Find my certificate" lookup by email and course, rate-limited and with a neutral answer when nothing matches.
- Spanish and English, accessible, and working under a strict CSP.

### Administration

- Admin, Editor and Viewer roles, checked on the server for every action.
- Rate-limited login, and an audit log of every change.
- Scheduled backups to any rclone remote (S3, Google Drive, Dropbox, etc.) with retention.

## 🚀 Deployment

You need a Linux server with Docker (with Compose) and an nginx that already handles TLS for your domain. cert-it
doesn't ship its own nginx.

### What to change for your setup

| Your setup                                                                                                                 | Files to change                                                                                            |
|----------------------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------|
| Every setup                                                                                                                | `config/config.yml`: `site.base_url`, `site.org_name` and `admin.email`                                    |
| Data somewhere other than `/srv/cert-it`, another port than `3000`, another user than `1000:1000`, or another memory limit | `deploy/.env`: `CERT_IT_DIR`, `APP_PORT`, `APP_UID`/`APP_GID`, `APP_MEMORY`                                |
| App on its own host (`https://certs.example.org`)                                                                          | `deploy/nginx/host.conf`: `server_name`, certificate paths, port and `/srv/cert-it`                        |
| App under a path of an existing site (`https://example.org/certs`)                                                         | `deploy/nginx/path.conf`: `/certs` in every block and the port                                             |
| nginx sends the PDFs (`files.serve: accel`, own host or same machine only)                                                 | `config/config.yml`: `files.serve: accel`. `deploy/.env`: `APP_GID` set to a group nginx's user belongs to |

Each file lists, at its top, what to replace in it.

### 1. Get the code and create the app directory

The image is built from the repository, so `docker compose` runs from its `deploy/` folder, not from the repository root
or the app directory.

```bash
git clone <repo-url> /opt/cert-it
sudo mkdir -p /srv/cert-it/data /srv/cert-it/config
sudo cp /opt/cert-it/config.example.yml /srv/cert-it/config/config.yml
sudo chown -R 1000:1000 /srv/cert-it/data   # APP_UID:APP_GID
```

`/srv/cert-it/config/` is mounted read-only into the container as a folder, so it holds `config.yml` and, for backups,
`rclone.conf`.

If you need other values than the defaults (see the table above), create `/opt/cert-it/deploy/.env`:

```bash
CERT_IT_DIR=/srv/cert-it
APP_PORT=3000
APP_UID=1000
APP_GID=1000
APP_MEMORY=256m
```

### 2. Edit `config/config.yml`

A minimal config looks like this:

```yaml
site:
  base_url: https://certs.example.org
  org_name: 'Example Org'
admin:
  email: admin@example.org # the first Admin account email, whose password is created and logged on first start
```

The [`config.example.yml`](config.example.yml) lists every option with its default and what it does: language, LinkedIn,
favicon, link previews (Open Graph and Discord), PDF delivery, upload limits, font catalog, rate limits and backups.

To change a setting later, edit `config/config.yml` and run `docker compose restart` from `/opt/cert-it/deploy`. If the
file is invalid, the app stops at startup and `docker compose logs app` says what to fix.

### 3. Start the app

```bash
cd /opt/cert-it/deploy
docker compose up -d --build
docker compose logs app        # the first Admin's password is printed once, here
curl http://127.0.0.1:3000/healthz
```

The app listens on `127.0.0.1:3000` (or `APP_PORT`) only. `/healthz` answers at the root even when `base_url` has a
path.

After changing `APP_UID` or `APP_GID`, or updating the code with `git pull`, run `docker compose up -d --build` again.

### 4. Add the nginx config

Pick the variant that matches your `base_url`. Afterward, reload nginx:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

#### Own host (eg `certs.example.org`)

1. Copy `deploy/nginx/host.conf` into nginx's `conf.d/`.
2. Set `server_name`, the certificate paths and the port, as listed at the top of the file.
3. Optionally, to let nginx send the PDFs, set `files.serve: accel`, check that the `_files` alias points at your
   `data/certificates/` folder, and add nginx's user to the group `APP_GID` so it can read that folder. Without it, keep
   `files.serve: stream`; the `_files` block is then unused.

#### Path on an existing site (eg `example.org/certs/`)

Paste the `location` blocks from `deploy/nginx/path.conf` into that site's `server { … }`, replacing `/certs` with your
path if it's different and setting the port. The second block gives the admin panel the CSP its template editor needs;
it's only needed if the site sets its own CSP.

### 5. Sign in

Open `{base_url}/admin/`, sign in with `admin.email` and the password from step 3, and set a new password. Then create
accounts for your staff under Users.

On its first start the app also creates the key that signs the credentials, at `data/keys/issuer.pem`. Keep it with the
rest of the data directory: a new key can't sign for credentials already handed out, and anyone with it can issue
credentials in your name.

### 6. Set up backups (optional)

Each backup is one ZIP named after the time it was taken (`cert-it-20261123T030000Z.zip`, in UTC).
It holds a consistent copy of the database and every file in the data directory: fonts, base PDFs, certificates, the
signing key and `site.json`. The app uploads it with [rclone](https://rclone.org) to every remote in the config, then
deletes the old ones. Nothing else in the remote's folder is touched.

1. Create `config/rclone.conf` with your remotes. The easiest way is `rclone config` on any machine with rclone
   installed. For Google Drive or Dropbox, which sign in through a browser,
   see [remote setup](https://rclone.org/remote_setup/). The file holds the remotes' credentials, so make it readable by
   the app's user only:

   ```bash
   sudo chown 1000:1000 /srv/cert-it/config/rclone.conf   # APP_UID:APP_GID
   sudo chmod 600 /srv/cert-it/config/rclone.conf
   ```

2. Fill in the `backup` section of `config/config.yml`:

   ```yaml
   backup:
     enabled: true
     schedule: '0 3 * * *' # every day at 03:00
     retention_days: 30
     retention_copies: # optional, keeps at most this many
     remotes:
       - 's3:my-bucket/cert-it'
   ```

   The schedule uses the container's time zone, UTC by default. To use yours, set `TZ` in `deploy/.env` (for example
   `TZ=America/Lima`).

3. Restart with `docker compose restart` from `/opt/cert-it/deploy`. If rclone or a remote is missing, the app stops at
   startup and the log says which.
4. Take a first backup right away to check that it works:

   ```bash
   docker compose exec app node dist/backup.mjs
   ```

Each backup is logged with its size and time, and a failed upload is logged with rclone's error, so check
`docker compose logs app` now and then. The config folder is mounted read-only, so for remotes that sign in through a
browser rclone logs that it couldn't save a refreshed token. That's expected: it gets a new one on each run.

Keep a copy of `config/config.yml` and `config/rclone.conf` somewhere other than the server: they aren't in the backups,
and you need `rclone.conf` to get them back.

### Restoring from a backup

This works the same on the old server or a new one. On a new server, first follow steps 1 to 4, with the same
`config.yml` (in particular the same `site.base_url`) and `rclone.conf`, but don't start the app. Every command runs
from `/opt/cert-it/deploy` and uses the app's image, which has rclone, so nothing needs installing on the server.

1. Stop the app and set the current data directory aside. Delete it once the restored app works.

   ```bash
   docker compose down
   sudo mv /srv/cert-it/data /srv/cert-it/data.old
   sudo mkdir /srv/cert-it/data
   sudo chown 1000:1000 /srv/cert-it/data   # APP_UID:APP_GID
   ```

2. List the backups on a remote, and download the one you want into the data directory:

   ```bash
   docker compose run --rm --no-deps app rclone lsf s3:my-bucket/cert-it
   docker compose run --rm --no-deps app rclone copy s3:my-bucket/cert-it/cert-it-20261123T030000Z.zip /app/data
   ```

3. Unzip it in place and delete the ZIP:

   ```bash
   docker compose run --rm --no-deps -w /app/data app unzip -q cert-it-20261123T030000Z.zip
   docker compose run --rm --no-deps app rm /app/data/cert-it-20261123T030000Z.zip
   ```

4. Start the app and check it:

   ```bash
   docker compose up -d
   docker compose logs app
   ```

   Sign in, open a course and one of its certificates' public pages (`{base_url}/c/{code}`), and download its PDF.

Anything done after the backup was taken is lost: certificates issued since then are missing, and their QR codes lead to
"not found".

### Moving to a new address

Certificates keep the address they were issued under: their QR codes and verifiable credentials point to it. So once one
is issued, the app records `site.base_url` and won't start with a different one until you confirm the move:

1. Redirect every path under the old address to the same path under the new one (for example,
   `https://old.example.org/c/ABCD` to `https://certs.example.org/c/ABCD`), and keep that redirect for as long as the
   certificates matter.
2. Set `site.base_url` to the new address and `site.previous_base_url` to the old one, then restart.

The app then renders every certificate again in the background, so new downloads use the new address.

## 💻 Development

Requires Node 24 and pnpm 12.

```bash
pnpm install      # install dependencies and the Git hooks
pnpm dev          # run the server, the admin panel and the public pages' scripts, with reload on changes
pnpm check        # format, lint and type check
pnpm fix          # fix formatting and lint issues
pnpm test         # run every package's tests
pnpm build        # build all packages
```

`pnpm dev` needs no config file. Open the admin panel at http://localhost:5173/admin/ and log in as
`admin@cert-it.test`,
`editor@cert-it.test`, `viewer@cert-it.test` or `new@cert-it.test` (which must change its password first), all with
the password `cert-it-dev`. Public pages are served by the server itself, such as the seeded certificate at
http://localhost:3000/c/DEVA-AAAA-01. To run the server with your own `config/config.yml` instead, use
`pnpm --filter @cert-it/server dev:config`
and set `CERT_IT_BASE_URL` to its `base_url` for the admin dev server.

To run the app behind an nginx set up like a real server (under `/certs/` with a strict CSP, and on its own host with
`X-Accel-Redirect`), see [`deploy/dev/compose.yml`](deploy/dev/compose.yml):

```bash
cd deploy/dev
docker compose up -d --build
bash check.sh
```
