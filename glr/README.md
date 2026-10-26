# GLR — roll, play and track The Guardian Legend randomizer seeds in one page

> **Beta:** the seed generator is new and not fully vetted yet. A seed may have
> mistakes (an item out of reach, say); please report anything odd.

Part of [Rando Hub](https://github.com/hugecrankhank/Rando-hub): play it at
https://hugecrankhank.github.io/Rando-hub/glr/ (or from the hub's Game row).
This folder is the app; the separate repository it started in was for beta testing
and is archived.

The Guardian Legend sibling of Z1R Unified and ALTTPR Unified. Generate a
randomized Guardian Legend (NES) from your own ROM, play it in the browser,
and the tracker follows along, with the labyrinth map drawn from the ROM
itself. Works on PC and phones, and installs as an app.

## Run it

Serve it over HTTP (opening `index.html` as a file blocks the map worker):

```bash
python3 -m http.server 8080      # or: npx serve .
```

Open http://localhost:8080, tap **New seed**, choose your
*Guardian Legend, The (USA)* `.nes` ROM, pick a preset or flags, tap
**Generate**, then **Play now**. Already have a ROM? **Play ROM file** plays
it with the tracker (and with the password option switched off).

On the web it's served as part of Rando Hub's site (Rando Hub's deploy publishes it).

Command line (Node 18+):

```bash
node tools/glr.js Guardian_Legend.nes 12345 K1I2B1      # writes the seed + spoiler log
node tools/test.js Guardian_Legend.nes 500               # checks 500 seeds
```

## What gets randomized

| Flag | Values | |
|---|---|---|
| `K` corridor keys | `0` vanilla, `1` shuffled | Which primary corridor (1-10) hands out which of the 7 keys |
| `I` items | `0` vanilla, `1` item rooms, `2` item rooms + mini-boss drops | The 34 labyrinth item rooms and 22 mini-boss drops share one pool (sub-weapons, Enemy Eraser, Energy Tanks, Blue/Red Landers, Attack, Defense, Shield) |
| `B` corridor bonus | `0` vanilla, `1` shuffled | The items handed out on the "YOU GOT ITEM" screen after corridors |

Presets: **Standard** `K1I2B1`, Keys only `K1I0B0`, Items only `K0I2B0`,
Light `K1I1B0`, Vanilla `K0I0B0` (nothing moved, password still off).

**Passwords are off.** The title screen's PASSWORD CONTINUE line is replaced by
the seed's code (`GLR XXXXXX`) and the cursor can't reach it. Progress is kept
with save states (four slots, F5 / F8) and an autosave every 20 s, so
**Continue** resumes where you were.

### Logic

The labyrinth is a 24 x 24 grid of screens. Keys only work on doors next to
*inner* rooms (corridor gates, Blue Landers, shops, messages), and they work
both ways: the door **into** an inner room needs that room's key, and a door
**out of** an inner room into a normal room needs that room's key. Corridor
gate rooms therefore act as locks between areas. Every seed is played through
on that door graph:

- keys come from clearing primary corridors (1-10);
- corridor 6 opens by firing a sub-weapon in its room, so a sub-weapon must
  be reachable before it's needed;
- corridor 4 opens after buying from a shop, so a shop must be reachable;
- corridor 21 opens once corridors 1-10 are cleared, and every screen must be
  reachable with all seven keys.

`tools/test.js` re-reads each generated ROM's own tables and replays it the
same way. GLR is new: report odd seeds with the seed, flags and spoiler log.

## What's in the page

```
index.html
├── emu/                  the NES emulator (shared with Z1R Unified)
│   ├── fceumm.wasm       libretro FCEUmm + core/frontend.c, clang + wasi-libc
│   ├── core.js           loads the wasm (minimal WASI shim)
│   ├── player.js         game box: on-screen controller, top bar, menu, saves
│   ├── video.js          WebGL2 shader runner (6xBRZ, 4xBRZ, sharp, smooth, CRT)
│   └── audio.js          AudioWorklet output with drift correction
├── js/tgl-data.js        the ROM layout: room table, item/key tables, RAM map
├── js/randomizer.js      GLR: shuffles, logic, ROM patch, spoiler log
├── js/cpu6502.js         small 6502 interpreter
├── js/labmap.js          builds and paints every screen (js/labmap-worker.js)
├── js/tracker.js         items, keys, corridors, map, pickup log
├── js/seed.js            "New seed" dialog
├── js/nes-bridge.js      the tracker's live view of the NES's 2 KB RAM
└── js/diag.js            crash recorder and status panel
```

**The map is drawn from your ROM.** For each of the 370 screens, GLR runs the
game's own room-building code (bank 5, entered from `$EEE0` / `$EE1D`) in a
6502 interpreter, which fills the 16 x 12 metatile buffer at `$0740` exactly
as the console does: walls, floor, the yellow / red / blue pyramids, doors and
item spots. GLR paints those metatiles with per-area colours and puts each
door's key symbol on it. Graphics uploads and sound are skipped, so no game
art is shipped or copied.

**Tracker.**

- **Items:** the 11 sub-weapons with their level, Enemy Eraser ammo, Blue and
  Red Landers, Attack, Defense and Shield. Tap to set by hand.
- **Keys** and **Corridors 1-21:** each corridor shows the key its gate needs
  (bottom right), lights up when you can reach it with your keys, and turns
  green with the key it gave once cleared.
- **Map:** the labyrinth drawn from the ROM. Screens fade once walked; item
  rooms and mini-bosses get a dot (green: reachable now, red: needs a key)
  and a check mark when done; corridor gates show their number; Blue Lander
  save rooms and shops are marked. Tap a screen for a close-up with its
  locked doors and what it needs.
- **Log:** every pickup, corridor and key, with where it came from.

**Autotracking** reads the NES's RAM: `$52/$53` screen, `$30` corridor
flag, `$47/$48` health, `$4C/$4D` chips, `$4A` attack, `$4B` defense, `$6B`
shield, `$46` Red Landers, `$04A0-$04A8` item and mini-boss flags,
`$04A9-$04AA` corridors cleared, `$04AC-$04AE` sub-weapon levels, `$04AF`
Enemy Eraser ammo, `$04B0` keys. What a room holds is read from the ROM but
only shown once you've picked it up. Tracking is saved per ROM.

See [docs/ROM-NOTES.md](docs/ROM-NOTES.md) for the ROM and RAM notes.

## Debugging

```js
NesBridge.peek(0x4A0, 17)   // item flags, corridors, weapons, keys
GLRTracker._state()         // tracker data for this ROM
```

## Credits

- Emulator: [libretro FCEUmm](https://github.com/libretro/libretro-fceumm)
  (GPL-2.0, `core/LICENSES/`); player from ALTTPR Snes9x / Z1R Unified; shaders
  from [libretro/glsl-shaders](https://github.com/libretro/glsl-shaders).
- Randomizer, map and tracker: reverse-engineered from the ROM for this
  project. Icons are original pixel art.
- No ROMs are included. Use your own legally obtained copy.
