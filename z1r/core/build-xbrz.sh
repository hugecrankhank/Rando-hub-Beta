#!/bin/sh
# Builds emu/xbrz.wasm: Zenju's xBRZ (core/xbrz/, GPL-3.0, the copy Mesen
# ships) with a small wrapper (RGB565 in, RGBA out), for the browser.
# Needs wasi-sdk (https://github.com/WebAssembly/wasi-sdk):
#   WASI_SDK=/path/to/wasi-sdk sh core/build-xbrz.sh
# The same file is copied to glr/emu/ and emu/ (the SNES player).
set -eu
here=$(cd "$(dirname "$0")" && pwd)
: "${WASI_SDK:?set WASI_SDK to a wasi-sdk directory}"
"$WASI_SDK/bin/clang++" --target=wasm32-wasi -O3 -fno-exceptions -fno-rtti -DNDEBUG \
  -nostartfiles -Wl,--no-entry -Wl,--export=malloc -Wl,--export-memory -Wl,--allow-undefined \
  -o "$here/../emu/xbrz.wasm" "$here/xbrz/xbrz.cpp" "$here/xbrz/wrap.cpp"
ls -la "$here/../emu/xbrz.wasm"
