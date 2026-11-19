FROM nginx:1.28.0-alpine

RUN apk add --no-cache openssl \
 && mkdir -p /etc/letsencrypt/live/certs.example.org \
 && openssl req -x509 -newkey rsa:2048 -nodes -days 365 \
      -subj "/CN=localhost" \
      -addext "subjectAltName=DNS:localhost,DNS:certs.example.org" \
      -keyout /etc/letsencrypt/live/certs.example.org/privkey.pem \
      -out /etc/letsencrypt/live/certs.example.org/fullchain.pem

COPY site.conf /etc/nginx/conf.d/default.conf
COPY --chmod=755 40-cert-it-configs.sh /docker-entrypoint.d/
