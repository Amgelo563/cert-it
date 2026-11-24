#!/usr/bin/env bash
# Usage: bash check.sh, with the dev compose running
# Prints each response and exits 1 if any check fails
set -u
cd "$(dirname "$0")"

P=https://localhost:8443/certs
H=https://certs.example.org:8443
C="curl -sk --resolve certs.example.org:8443:127.0.0.1 --resolve certs.example.org:8080:127.0.0.1"
fails=0

section() { printf '\n=== %s\n' "$1"; }
pass() { printf '  ok: %s\n' "$1"; }
fail() { printf '  FAIL: %s\n' "$1"; fails=$((fails + 1)); }

# has/lacks <output> <regex> <label>
has() { if grep -qiE -- "$2" <<<"$1"; then pass "$3"; else fail "$3"; fi; }
lacks() { if grep -qiE -- "$2" <<<"$1"; then fail "$3"; else pass "$3"; fi; }

status() { $C -o /dev/null -w '%{http_code} %{redirect_url}\n' "$@"; }
headers() { $C -D - -o /dev/null "$@" | tr -d '\r' | grep -iE '^(HTTP|content-type|location|cache-control|x-frame-options|x-content-type-options|strict-transport-security|content-security-policy)'; }
pdf_headers() { $C -D - -o /dev/null "$@" | tr -d '\r' | grep -iE '^(HTTP|content-type|content-disposition|content-length|content-range|accept-ranges|cache-control|x-accel-redirect)'; }

# run, print and keep the output in $out
show() { out=$("$@"); printf '%s\n' "$out"; }

# CSPs the app and nginx set
AppCsp="^content-security-policy: default-src 'self'; object-src 'none'"
SiteCsp="^content-security-policy: default-src 'self'; script-src 'self';"
AdminCsp="^content-security-policy: .*'wasm-unsafe-eval'"

# the PDF checks use DEVA-CTIV-EA (active) and DEVR-EVOK-ED (revoked), from seed.mjs
pdf_checks() {
  section "$1: certificate PDF"
  show pdf_headers "$2/c/DEVA-CTIV-EA/pdf"
  has "$out" '^HTTP/\S+ 200' '200'
  has "$out" '^content-type: application/pdf' 'application/pdf'
  has "$out" '^content-disposition: inline' 'inline'
  has "$out" '^accept-ranges: bytes' 'Accept-Ranges'
  lacks "$out" '^x-accel-redirect' 'no X-Accel-Redirect leaked'

  section "$1: certificate PDF with ?download=1"
  show pdf_headers "$2/c/DEVA-CTIV-EA/pdf?download=1"
  has "$out" '^content-disposition: attachment' 'attachment'

  section "$1: Range bytes=0-99"
  show pdf_headers -H 'Range: bytes=0-99' "$2/c/DEVA-CTIV-EA/pdf"
  has "$out" '^HTTP/\S+ 206' '206'
  has "$out" '^content-range: bytes 0-99/[0-9]+$' 'Content-Range bytes 0-99/<size>'
  has "$out" '^content-length: 100$' 'Content-Length 100'

  section "$1: Range past the end"
  show pdf_headers -H 'Range: bytes=999999999-' "$2/c/DEVA-CTIV-EA/pdf"
  has "$out" '^HTTP/\S+ 416' '416'
  has "$out" '^content-range: bytes \*/[0-9]+$' 'Content-Range bytes */<size>'

  section "$1: revoked and unknown certificates"
  show status "$2/c/DEVR-EVOK-ED/pdf"
  has "$out" '^404' 'revoked 404'
  show status "$2/c/NOPE-NOPE-NO/pdf"
  has "$out" '^404' 'unknown 404'
}

section "Seeding test certificates"
for app in app-path app-host; do
  if docker compose exec -T "$app" node seed.mjs; then pass "seeded $app"; else fail "seeded $app"; fi
done

section "B: /healthz over HTTPS under /certs"
show status $P/healthz
has "$out" '^200' '200'

section "B: /certs without the slash"
show status https://localhost:8443/certs
has "$out" '^301 \S*/certs/$' '301 to /certs/'

section "B: public page"
show headers $P/
has "$out" "$SiteCsp" "site's strict CSP"
lacks "$out" "$AppCsp" "app's CSP hidden"

section "B: admin page"
show headers $P/admin/
has "$out" "$AdminCsp" 'admin CSP from nginx'
has "$out" '^x-frame-options: SAMEORIGIN' 'X-Frame-Options'
has "$out" '^x-content-type-options: nosniff' 'nosniff'
lacks "$out" '^strict-transport-security' 'no HSTS'

section "B: upload limit"
tmp=$(mktemp -d)
head -c 5000000 /dev/zero > "$tmp/5m.bin"
head -c 12000000 /dev/zero > "$tmp/12m.bin"
show status -X POST --data-binary @"$tmp/5m.bin" -H 'Content-Type: application/octet-stream' $P/api/upload
lacks "$out" '^413' '5 MB not 413'
show status -X POST --data-binary @"$tmp/12m.bin" -H 'Content-Type: application/octet-stream' $P/api/upload
has "$out" '^413' '12 MB 413'
rm -rf "$tmp"

pdf_checks "B (stream)" "$P"

section "A: HTTP redirects to HTTPS"
show status http://certs.example.org:8080/
has "$out" '^301 https://' '301 to https'

section "A: /healthz over HTTPS"
show status $H/healthz
has "$out" '^200' '200'

section "A: public page"
show headers $H/
has "$out" "$AppCsp" "app's own CSP"
has "$out" '^strict-transport-security' 'HSTS'

section "A: admin page"
show headers $H/admin/
has "$out" "$AdminCsp" "app's admin CSP"

pdf_checks "A (accel)" "$H"

section "A: _files is internal"
show status $H/_files/1/DEVA-CTIV-EA.pdf
has "$out" '^404' '404'

section "nginx sees data/certificates/ read-only"
show docker compose exec -T nginx sh -c 'ls -ld /srv/cert-it/data/certificates && touch /srv/cert-it/data/certificates/x 2>&1 | head -1'
has "$out" 'read-only file system' 'read-only'

section "Client IPs the apps logged"
docker compose logs --no-log-prefix --tail 5 app-path app-host

section "Result"
if [ "$fails" -gt 0 ]; then
  echo "$fails check(s) failed"
  exit 1
fi
echo "All checks passed"
