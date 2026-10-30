# Super Mario RPG — roll, play and track Open World Randomizer seeds in one page

> **Beta:** new. If a seed won't generate or the tracker misses something, please say so.

Part of [Rando Hub](https://github.com/hugecrankhank/Rando-hub): play it at
https://hugecrankhank.github.io/Rando-hub/smrpg/ (or from the hub's Game row).

Generate a [Super Mario RPG Open World Randomizer](https://randomizer.smrpgspeedruns.com/)
seed from your own ROM, play it in the browser on the hub's Snes9x, and the tracker
follows along. Works on PC, tablets and phones, and installs as an app.

## How it works

- **The generator is the randomizer itself.** The site's Python
  ([smrpg_web_randomizer](https://github.com/Super-Mario-RPG-Randomizer/smrpg_web_randomizer),
  MIT, its `randomizer/logic` and `randomizer/data` unchanged, `gen/smrpg_randomizer.zip`)
  runs in your browser with Pyodide (Python compiled to WebAssembly), in a worker, so the
  page stays responsive. The site makes a patch and puts it on your ROM in the browser;
  here both halves run in the worker. Python and the generator are downloaded the first
  time you roll (about 15 MB, then cached). A seed takes a few seconds. Nothing is
  uploaded: your ROM stays on the device.
- **The ROM:** Super Mario RPG: Legend of the Seven Stars (USA), 4 MB, the same one the
  site wants (checked by MD5; a copier header is taken off). It's remembered in this
  browser for the next seed. The game's SA-1 chip is emulated.
- **Flags:** the site's presets (Casual, Intermediate, Advanced, Expert, Quick, the 2021
  Fall Async Tournament set, Standard Bingo), its whole flag list to tick through
  (*Customize flags*), or paste any flag string from the site, a race or a friend.
  Open world or linear mode. Seeds are a number (1 to 4294967295) or any word, as on
  the site; the same seed, mode and flags make the same game, so share all three.
- **The result:** Play now, or download the ROM and the spoiler (where the Star Pieces,
  bosses and key items went). The file-select hash and character are the site's.

## The tracker

Read from the running game every half second (no setup):

- **Star Pieces** (the count, 6 or 7 to open Bowser's Keep), **key items** (the 19 the
  randomizer can shuffle: Rare Frog Coin, Cricket Pie, Bambino Bomb, the Castle Keys,
  the Cards, the Flags, the Shed, Elder, Temple and Room Keys, Cricket Jam, Seed,
  Fertilizer, Bright Card), **the party** with levels and HP, **coins** and **Frog Coins**.
- **Bosses**: every boss fight is its own formation pack (`$7E:0048`), so when a battle
  with a boss pack ends with the party standing (`$316D` drops), that boss is beaten;
  the seed's spoiler says which spot it sat in (the shuffle moves bosses around), so
  that spot is ticked. Without a spoiler the boss is listed as beaten and the spot is
  yours to tap. With **Reveal** on, each spot shows who's really there and ★ where a
  Star Piece is, and the key items show where they are. Reveal is off by default, so a
  stream doesn't give the seed away.
- Anything the game can't tell us you can tick by hand; manual ticks are kept per seed.

Memory map (found with the emulator; the event memory layout as Lazy Shell documents it):
the save block at `$7F:F800` (the new-game copy is at ROM `$3A002C`): 20 bytes per
character (level, HP, max HP, stats, exp, equips), the 15 special items at `$7F:F8A0`,
coins `$7F:F8AF`, FP `$7F:F8B1`, Frog Coins `$7F:F8B3`. The event script engine's memory
(`$7000-$70FF`) is on the SA-1, in its BW-RAM at `$3000`: `$70D5` counts Star Pieces (the
open-mode star routine: *if $70D5 == 6…, $70D5 += 1, star sequence #n*). The SA-1's I-RAM
has the current area (`$3030`), the party size (`$3032`), who is in it (`$3033…`) and
the battle flag (`$316D`).

## Files

- `index.html`, `js/app.js` — the page: the player, the layout, the autosave, the app bits
- `js/seed.js` — the New seed dialog and the flag builder; `gen/seed-worker.js` — the
  generator in Pyodide; `gen/smrpg_randomizer.zip` — the randomizer (MIT, see its `LICENSE`)
- `js/data.js` — presets, the flag tree (written by `tools/smrpg-bundle.py` from the
  randomizer's `flags.py`), key items, locations, the memory map
- `js/tracker.js`, `js/store.js`, `hub.js` (the hub's glue), `sw.js`, `manifest.webmanifest`

To update the generator: `python3 tools/smrpg-bundle.py /path/to/smrpg_web_randomizer`.
