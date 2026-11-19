#!/usr/bin/env bash
# Usage: bash check.sh, with the dev compose running
P=https://localhost:8443/certs
H=https://certs.example.org:8443
C="curl -sk --resolve certs.example.org:8443:127.0.0.1 --resolve certs.example.org:8080:127.0.0.1"

section() { printf '\n=== %s\n' "$1"; }
status() { $C -o /dev/null -w '%{http_code} %{redirect_url}\n' "$@"; }
headers() { $C -D - -o /dev/null "$@" | tr -d '\r' | grep -iE '^(HTTP|content-type|location|cache-control|x-frame-options|x-content-type-options|strict-transport-security|content-security-policy)'; }

pdf_headers() { $C -D - -o /dev/null "$@" | tr -d '\r' | grep -iE '^(HTTP|content-type|content-disposition|content-length|content-range|accept-ranges|cache-control|x-accel-redirect)'; }

# the PDF checks use DEVA-CTIV-EA (active) and DEVR-EVOK-ED (revoked), from seed.mjs
pdf_checks() {
  section "$1: certificate PDF (expect 200, application/pdf, inline, Accept-Ranges, no X-Accel-Redirect leaked)"
  pdf_headers "$2/c/DEVA-CTIV-EA/pdf"

  section "$1: certificate PDF with ?download=1 (expect attachment)"
  pdf_headers "$2/c/DEVA-CTIV-EA/pdf?download=1" | grep -i '^content-disposition'

  section "$1: Range bytes=0-99 (expect 206, Content-Range bytes 0-99/<size>, Content-Length 100)"
  pdf_headers -H 'Range: bytes=0-99' "$2/c/DEVA-CTIV-EA/pdf"

  section "$1: Range past the end (expect 416, Content-Range bytes */<size>)"
  pdf_headers -H 'Range: bytes=999999-' "$2/c/DEVA-CTIV-EA/pdf"

  section "$1: revoked and unknown certificates (expect 404 404)"
  status "$2/c/DEVR-EVOK-ED/pdf"
  status "$2/c/NOPE-NOPE-NO/pdf"
}

section "Seeding test certificates"
docker compose exec -T app-path node seed.mjs
docker compose exec -T app-host node seed.mjs

section "B: /healthz over HTTPS under /certs (expect 200)"
status $P/healthz

section "B: /certs without the slash (expect 301 to /certs/)"
status https://localhost:8443/certs

section "B: public page (expect the site's strict CSP, the app's hidden)"
headers $P/

section "B: admin page (expect the admin CSP from nginx, plus the app's X-Frame-Options and nosniff, no HSTS)"
headers $P/admin/

section "B: upload limit (expect 5 MB not 413, 12 MB 413)"
tmp=$(mktemp -d)
head -c 5000000 /dev/zero > "$tmp/5m.bin"
head -c 12000000 /dev/zero > "$tmp/12m.bin"
status -X POST --data-binary @"$tmp/5m.bin" -H 'Content-Type: application/octet-stream' $P/api/upload
status -X POST --data-binary @"$tmp/12m.bin" -H 'Content-Type: application/octet-stream' $P/api/upload
rm -rf "$tmp"

pdf_checks "B (stream)" "$P"

section "A: HTTP redirects to HTTPS (expect 301)"
status http://certs.example.org:8080/

section "A: /healthz over HTTPS (expect 200)"
status $H/healthz

section "A: public page (expect the app's own CSP)"
headers $H/

section "A: admin page (expect the app's admin CSP)"
headers $H/admin/

pdf_checks "A (accel)" "$H"

section "A: _files is internal (expect 404)"
status $H/_files/1/DEVA-CTIV-EA.pdf

section "nginx sees data/certificates/ read-only"
docker compose exec -T nginx sh -c 'ls -ld /srv/cert-it/data/certificates && touch /srv/cert-it/data/certificates/x 2>&1 | head -1'

section "Client IPs the apps logged"
docker compose logs --no-log-prefix --tail 5 app-path app-host
