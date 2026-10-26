#!/usr/bin/env bash
# Builds the Windows app (portable folder + zip) on Linux or macOS, no Wine:
#
#   desktop/build/build-win.sh path/to/Rando-Hub-vX.Y.Z/app [out-dir] [electron-version]
#
# Uses the official Electron Windows x64 build from GitHub, puts the app in
# resources/app, renames electron.exe to "<productName>.exe" and gives it the
# Rando Hub icon and version info. Which app this is (name, website, releases,
# port) comes from desktop/config.json.
# Output: <out-dir>/<assetPrefix>-vX.Y.Z.zip (out-dir defaults to desktop/dist)
# Needs: curl, unzip, zip, python3, and the pefile module (pip install pefile).
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
WEB_SRC="$(cd "${1:?path to the release app/ folder}" && pwd)"
DIST="$(mkdir -p "${2:-$HERE/dist}" && cd "${2:-$HERE/dist}" && pwd)"
EV="${3:-44.9.3}"
VERSION="$(sed -n 's/.*<meta name="version" content="\([^"]*\)".*/\1/p' "$WEB_SRC/index.html" | head -1)"
cfg() { python3 -c "import json,sys; print(json.load(open(sys.argv[1]))[sys.argv[2]])" "$HERE/config.json" "$1"; }
NAME="$(cfg productName)"; PREFIX="$(cfg assetPrefix)"; SITE="$(cfg website)"
CACHE="$HERE/.cache"; WORK="$HERE/.work"; OUT="$WORK/$NAME"
ZIP="electron-v$EV-win32-x64.zip"
mkdir -p "$CACHE"
echo "Building $NAME v$VERSION (Electron $EV)"

if [ ! -f "$CACHE/$ZIP" ] || [ ! -f "$CACHE/SHASUMS256-$EV.txt" ]; then
  curl -fsSL -o "$CACHE/$ZIP" "https://github.com/electron/electron/releases/download/v$EV/$ZIP"
  curl -fsSL -o "$CACHE/SHASUMS256-$EV.txt" "https://github.com/electron/electron/releases/download/v$EV/SHASUMS256.txt"
fi
( cd "$CACHE" && grep " \*$ZIP\$" "SHASUMS256-$EV.txt" | sed 's/ \*/  /' | sha256sum -c - )

rm -rf "$WORK"; mkdir -p "$OUT"
unzip -q "$CACHE/$ZIP" -d "$OUT"
rm -f "$OUT/resources/default_app.asar"
mv "$OUT/LICENSE" "$OUT/LICENSE.electron.txt"

# the app: main process + config + the web files
APP="$OUT/resources/app"
mkdir -p "$APP"
cp "$HERE/src/main.js" "$HERE/src/preload.js" "$HERE/src/icon.png" "$APP/"
cp "$HERE/config.json" "$APP/desktop.json"
python3 - "$HERE/config.json" "$VERSION" > "$APP/package.json" <<'PY'
import json, sys
c = json.load(open(sys.argv[1]))
print(json.dumps({"name": c["productName"].lower().replace(" ", "-"), "productName": c["productName"],
                  "version": sys.argv[2], "description": c["productName"] + " for Windows", "main": "main.js",
                  "author": "hugecrankhank", "homepage": "https://github.com/" + c["repo"]}, indent=2))
PY
cp -r "$WEB_SRC" "$APP/web"
python3 "$HERE/build/patch_web.py" "$APP/web" "$SITE"

# the program itself
python3 "$HERE/build/pe_resources.py" "$OUT/electron.exe" "$OUT/$NAME.exe" "$HERE/build/icon.ico" \
  VERSION="$VERSION" FileDescription="$NAME" ProductName="$NAME" CompanyName="hugecrankhank" \
  InternalName="$NAME" OriginalFilename="$NAME.exe" \
  LegalCopyright="$NAME by hugecrankhank. Built on Electron (MIT)."
rm "$OUT/electron.exe"

for f in LICENSE.md NOTICE.md; do
  if [ -f "$WEB_SRC/../$f" ]; then cp "$WEB_SRC/../$f" "$OUT/"; else cp "$HERE/../$f" "$OUT/"; fi
done
sed -e "s/{{VERSION}}/$VERSION/g" -e "s/{{NAME}}/$NAME/g" -e 's/$/\r/' "$HERE/build/README-Desktop.txt" > "$OUT/README.txt"

NAME_ZIP="$PREFIX-v$VERSION.zip"
rm -f "$DIST/$NAME_ZIP"
( cd "$WORK" && zip -qr -9 "$DIST/$NAME_ZIP" "$NAME" )
rm -rf "$WORK"
echo "$DIST/$NAME_ZIP: $(du -h "$DIST/$NAME_ZIP" | cut -f1)"
