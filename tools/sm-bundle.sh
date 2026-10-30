#!/usr/bin/env bash
# Bundle DASH's core (https://github.com/dashrando/dash-randomizer, MIT) for the
# Super Metroid page: sm/gen/dash-core.js (an ES module the seed worker
# imports), its two base patches, its licence, and sm/js/data.js's presets.
#   DASH=/path/to/dash-randomizer tools/sm-bundle.sh
# Needs esbuild (npx esbuild, or /opt/npm-tools) and node.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$(dirname "$HERE")"
DASH="${DASH:?set DASH to the dash-randomizer checkout}"
ESBUILD="${ESBUILD:-$(command -v esbuild || echo /opt/npm-tools/node_modules/.bin/esbuild)}"
TMP="$(mktemp -d)"
sed "s#\$DASH#$DASH#g" "$HERE/sm-bundle/entry.ts" > "$TMP/entry.ts"
cp "$HERE/sm-bundle/buffer-shim.js" "$HERE/sm-bundle/buffer-global.js" "$TMP/"
"$ESBUILD" "$TMP/entry.ts" --bundle --format=esm --platform=browser --target=es2020 --alias:buffer="$TMP/buffer-shim.js" --inject:"$TMP/buffer-global.js" --outfile="$ROOT/sm/gen/dash-core.js"
cp "$DASH/apps/web/public/patches/"*.bps "$ROOT/sm/gen/patches/"
cp "$DASH/LICENSE.md" "$ROOT/sm/gen/LICENSE-DASH.md"
node "$HERE/sm-bundle/data.mjs" "$ROOT"
rm -rf "$TMP"
echo "bundled DASH from $(git -C "$DASH" log -1 --format='%h %cd' 2>/dev/null || echo '?')"
