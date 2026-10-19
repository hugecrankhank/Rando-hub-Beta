#!/bin/sh
# Linux: run ./start-rando-hub.sh in this folder to play Rando Hub locally.
cd "$(dirname "$0")"
if command -v node >/dev/null 2>&1; then exec node serve.mjs "$@"; fi
if command -v python3 >/dev/null 2>&1; then
  echo "Rando Hub at http://localhost:8067/ (Ctrl+C to stop)"
  (sleep 1; xdg-open http://localhost:8067/ >/dev/null 2>&1) &
  exec python3 -m http.server 8067 --bind 127.0.0.1 --directory app
fi
echo "Rando Hub needs Node.js (https://nodejs.org) or Python 3 to run locally."
