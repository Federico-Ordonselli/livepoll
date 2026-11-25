#!/bin/sh
# If no APP_KEY is provided, generate a random one on first start and keep it
# in the /data volume, so sessions survive restarts and no key is ever committed.
set -e
if [ -z "$APP_KEY" ]; then
  KEY_FILE=/data/app_key
  if [ ! -s "$KEY_FILE" ]; then
    node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('base64url'))" > "$KEY_FILE"
    echo "Generated a new APP_KEY in $KEY_FILE"
  fi
  APP_KEY="$(cat "$KEY_FILE")"
  export APP_KEY
fi
exec "$@"
