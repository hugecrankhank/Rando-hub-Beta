#!/bin/sh
# Double-click to start Crowd Control+. First time: right-click -> Open -> Open.
cd "$(dirname "$0")"
command -v node >/dev/null 2>&1 || { echo "Node.js is not installed: https://nodejs.org"; read -r _; exit 1; }
# First time only: the Direct TikTok connection needs one package (about a minute).
if [ ! -f node_modules/tiktok-live-connector/package.json ] && command -v npm >/dev/null 2>&1; then
  echo "Setting up the TikTok connection (first time only, about a minute)..."
  npm install --omit=dev --no-audit --no-fund --loglevel=error
fi
node bridge.mjs
