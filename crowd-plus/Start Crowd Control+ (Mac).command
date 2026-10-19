#!/bin/sh
# Double-click to start Crowd Control+. First time: right-click -> Open -> Open.
cd "$(dirname "$0")"
command -v node >/dev/null 2>&1 || { echo "Node.js is not installed: https://nodejs.org"; read -r _; exit 1; }
node bridge.mjs
