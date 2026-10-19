#!/bin/sh
# Double-click to play Rando Hub from this folder. If macOS says it can't be
# opened, right-click it -> Open -> Open (only needed the first time).
cd "$(dirname "$0")"
if command -v node >/dev/null 2>&1; then exec node serve.mjs; fi
if command -v python3 >/dev/null 2>&1; then
  echo "Starting Rando Hub at http://localhost:8067/ - keep this window open."
  (sleep 1; open http://localhost:8067/) &
  exec python3 -m http.server 8067 --bind 127.0.0.1 --directory app
fi
echo "Rando Hub needs Node.js to run from this folder: https://nodejs.org"
echo "(Or just play online: https://hugecrankhank.github.io/Rando-hub/ )"
read -r _
