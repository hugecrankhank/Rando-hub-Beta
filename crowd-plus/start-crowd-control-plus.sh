#!/bin/sh
# Linux: ./start-crowd-control-plus.sh   (add --test for practice mode)
cd "$(dirname "$0")"
# First time only: the Direct TikTok connection needs one package.
if [ ! -f node_modules/tiktok-live-connector/package.json ] && command -v npm >/dev/null 2>&1; then
  npm install --omit=dev --no-audit --no-fund --loglevel=error
fi
exec node bridge.mjs "$@"
