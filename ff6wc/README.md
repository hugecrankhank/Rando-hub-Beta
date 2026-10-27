# FF6 Worlds Collide — roll, play and track Final Fantasy VI: Worlds Collide seeds in one page

> **Beta:** new. If a seed won't generate or the tracker misses something, please say so.

Part of [Rando Hub](https://github.com/hugecrankhank/Rando-hub): play it at
https://hugecrankhank.github.io/Rando-hub/ff6wc/ (or from the hub's Game row).

The Final Fantasy VI sibling of Z1R and GLR. Generate a
[Worlds Collide](https://github.com/ff6wc/WorldsCollide) seed from your own ROM,
play it in the browser on the hub's Snes9x, and the tracker follows along.
Works on PC, tablets and phones, and installs as an app.

## How it works

- **The generator is Worlds Collide itself.** Its source (MIT, unchanged, `wc/worldscollide.zip`)
  runs in your browser with Pyodide (Python compiled to WebAssembly), in a worker, so
  the page stays responsive. Python and the generator are downloaded the first time
  you roll (about 15 MB, then cached). A seed takes roughly 10–40 s depending on the device.
  Nothing is uploaded: your ROM stays on the device.
- **The ROM:** Final Fantasy III (USA) v1.0, 3 MB, the same one ff6worldscollide.com
  wants (checked by SHA-256; a copier header is taken off). It's remembered in this
  browser for the next seed.
- **Flags:** the Ultros League set (with character gating, or the open-world version),
  or paste any flag string from ff6worldscollide.com's flag builder, a race, or a friend.
  Seeds are any word; the same seed and flags make the same game, so share both.
- **The result:** Play now, or download the ROM and the spoiler log (the log Worlds
  Collide writes).

## The tracker

Read from the running game's memory every half second (no setup):

- **Characters** (14) and **espers** (27), **checks** (the 62 Worlds Collide checks,
  by area), **dragons** (8), **bosses**, and whether **Kefka's Tower** is open.
- The counters along the top are the game's own (checks, espers, dragons, bosses).
- The seed's **objectives** and **hash**, from the spoiler log, on the Objectives tab.
- Anything the game can't tell us you can tick by hand; manual ticks are kept per seed.

Memory map: Worlds Collide's event bits (`$7E:1E80`, one bit per check, the same bits
its objectives use) and battle bits (`$7E:1DC9`, bosses), the character bytes at
`$7E:1EDE`, known espers at `$7E:1A69`, and the counters Stats Companion reads
(`$7E:1FCA` checks, `1FC8` espers, `1FCE` dragons, `1FF8` bosses).

## Layout

The game picture gets exactly its size (8:7, or 4:3 if the player is set so) and the
tracker takes the rest, so no screen space goes unused: sideways, the picture is as
tall as the page and the tracker fills the right; upright (phones, tablets held
upright), the picture is as wide as the page and the tracker fills the bottom. Narrow
trackers (phones, an iPad sideways) show one tab at a time.

## Saves

In-game saves are kept by the player (the cartridge's save RAM, per seed). F5 / F8 save
and load a state; the ⋯ menu on the game has the controls, filters and volume. A
snapshot every 20 s lets **Continue** pick up where you were if the app was closed.

## Files

- `index.html`, `js/app.js` — the page, layout, emulator boot, autosave
- `js/seed.js`, `wc/seed-worker.js`, `wc/worldscollide.zip` — the New seed dialog and the generator
- `js/tracker.js`, `js/data.js` — the tracker and its tables (checks, bits, presets)
- `hub.js` — the links back to the hub, Reroll and the seed history
- `../emu/` (shared) — Snes9x; `../pyodide/` (shared) — Python

To update Worlds Collide: zip its repository (without `.git`, `__pycache__`, `api/`,
`graphics/tools/`, `metadata/`) to `wc/worldscollide.zip`.
