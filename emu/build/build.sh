#!/usr/bin/env bash
# Builds snes9x.wasm from the libretro snes9x source with wasi-sdk.
#   WASI_SDK=/path/to/wasi-sdk SNES9X=/path/to/snes9x ./emu/build/build.sh
# Output: emu/snes9x.wasm
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
WASI_SDK="${WASI_SDK:?set WASI_SDK to the wasi-sdk directory}"
SNES9X="${SNES9X:?set SNES9X to the libretro/snes9x checkout}"
OUT="$HERE/.obj"; mkdir -p "$OUT"

# Pull the source list from the core's own Makefile.common.
SRC=$(make -s --no-print-directory -f - <<EOF
CORE_DIR := $SNES9X
include $SNES9X/libretro/Makefile.common
all:
	@echo \$(SOURCES_C) \$(SOURCES_CXX)
EOF
)

CC="$WASI_SDK/bin/clang --target=wasm32-wasip1 --sysroot=$WASI_SDK/share/wasi-sysroot"
CXX="$WASI_SDK/bin/clang++ --target=wasm32-wasip1 --sysroot=$WASI_SDK/share/wasi-sysroot"
FLAGS="-O3 -flto -fno-strict-aliasing -D__LIBRETRO__ -DALLOW_CPU_OVERCLOCK -DNDEBUG \
  -DHAVE_STRINGS_H -DHAVE_STDINT_H -DRIGHTSHIFT_IS_SAR -D_WASI_EMULATED_SIGNAL -D_WASI_EMULATED_PROCESS_CLOCKS \
  -mbulk-memory -mnontrapping-fptoint -msign-ext -mmutable-globals \
  -I$SNES9X/libretro -I$SNES9X/libretro/libretro-common/include -I$SNES9X -I$SNES9X/apu -I$SNES9X/apu/bapu \
  -Wno-everything"

objs=()
compile() {
  local src="$1" obj="$OUT/$(echo "$1" | sed "s|$SNES9X/||; s|/|_|g").o"
  if [[ "$src" == *.c ]]; then $CC $FLAGS -c "$src" -o "$obj"
  else $CXX $FLAGS -std=c++14 -fno-exceptions -fno-rtti -c "$src" -o "$obj"; fi
}
export -f compile; export CC CXX FLAGS OUT SNES9X
printf '%s\n' $SRC "$HERE/glue.cpp" | xargs -P "$(nproc)" -I{} bash -c 'compile "$@"' _ {}

$CXX $FLAGS -mexec-model=reactor -fno-exceptions \
  -Wl,--strip-all -Wl,-z,stack-size=1048576 \
  -lwasi-emulated-signal -lwasi-emulated-process-clocks \
  "$OUT"/*.o -o "$HERE/../snes9x.wasm"
ls -la "$HERE/../snes9x.wasm"
