#!/bin/sh
set -eu

mkdir -p /etc/nginx/cert-it

sed 's#127\.0\.0\.1:3000#app-host:3000#g' /etc/nginx/shipped/host.conf \
  > /etc/nginx/conf.d/host.conf
sed 's#127\.0\.0\.1:3000#app-path:3000#g' /etc/nginx/shipped/path.conf \
  > /etc/nginx/cert-it/path.conf
