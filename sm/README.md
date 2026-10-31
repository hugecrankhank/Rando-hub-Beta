# Super Metroid — roll, play and track DASH seeds in one page

> **Beta:** new. If a seed won't generate or the tracker misses something, please say so.

Part of [Rando Hub](https://github.com/hugecrankhank/Rando-hub): play it at
https://hugecrankhank.github.io/Rando-hub/sm/ (or from the hub's Game row).

Generate a [DASH](https://www.dashrando.net/) seed from your own ROM, play it in the
browser on the hub's Snes9x, and the tracker follows along. Works on PC, tablets and
phones, and installs as an app.

## How it works

- **The generator is DASH itself.** dashrando.net already makes its seeds in your browser;
  its core ([dash-randomizer](https://github.com/dashrando/dash-randomizer), MIT,
  `packages/core` unchanged) is bundled here as `gen/dash-core.js` and runs in a worker.
  A seed takes a fraction of a second. Nothing is uploaded: your ROM stays on the device.
- **The ROM:** Super Metroid (Japan, USA), 3 MB, the usual dump DASH wants (checked by
  SHA-256; a copier header is taken off). It's remembered in this browser for the next seed.
- **Settings:** DASH's modes (Classic M/M, Throwback 2017, Chozo Bozo, Surprise Surprise,
  SG Live 2023–2026, Spring Invitational 2024, and the Chozo / Full / area / boss shuffle
  sets), or its settings one by one as on the site's Generate page: item split, boss
  locations, map layout (area randomization), minor distribution, environment updates,
  Charge Beam, gravity heat reduction, Double Jump, Heat Shield, Pressure Valve, logic,
  bosses known, fanfare. Seeds are a number from 1 to 999999, as on the site; the same
  seed and settings make the same game (the file name carries DASH's own seed code).
- **The result:** Play now, or download the ROM and the spoiler (bosses, area doors and
  every item, the way the site writes it).

## The tracker

Read from the running game every half second (no setup):

- **Gear and beams** from Samus's equipment and beam words; **energy, reserve, missiles,
  supers and power bombs** with their maximums.
- **Bosses** (Kraid, Phantoon, Draygon, Ridley) and **mini-bosses** (Bomb Torizo, Spore
  Spawn, Crocomire, Golden Torizo, Botwoon, Mother Brain) from the game's boss bits.
- **Every item spot** by area: the game keeps a bit for each spot it has handed out, so
  spots tick themselves as you collect. With **Reveal** on, each spot shows what's there
  and a moved boss says where it is. Reveal is off by default.
- DASH's own items (Double Jump, Heat Shield, Pressure Valve) have no flag the tracker
  knows yet: tap them when you have them. Manual ticks are kept per seed.
- **The map:** the game's own area maps (Crateria, Brinstar, Norfair, Wrecked Ship,
  Maridia, Tourian) with a pin on every item spot, exactly where the item is, and Samus
  on it. Pinch, scroll or double-tap to zoom, drag to pan; tap a pin for its name (and
  its item with Reveal on) and to mark it by hand. **Follow** switches to the area Samus
  is in and keeps her in view. A diamond is a spot that comes right after a shuffled boss.
  The picture is drawn from your ROM when the page runs (the pause-screen map tiles),
  so nothing of it is shipped here; the pins' positions are numbers worked out from the
  room headers (`tools/sm-map-pins.py`, see below).

Memory map (Super Metroid's, well documented): `$7E:0998` game state (8 = playing),
`$7E:079F` area, `$7E:09A2` equipment collected, `$7E:09A6` beams, `$7E:09C2..09D6` energy,
ammo and reserve, `$7E:D828..` boss bits by area (bit 0 the boss, 1 the mini-boss, 2 the
Torizo), `$7E:D870..` item collected bits. Each spot's bit number is its item PLM's
argument in the ROM (`tools/sm-bundle.sh` doesn't compute these; they're in `js/data.js`).

The map: each area's pause-screen map is a 64x32 grid of 8x8 tiles (bank `$B5`; `$B5:8000`
is Brinstar, `$B5:9000` Crateria, then Norfair, Wrecked Ship, Maridia, Tourian), the tiles
4bpp in bank `$B6`, one tile per room screen. A room header (bank `$8F`) gives its area and
map X/Y; an item PLM gives its x/y in the room in 16 px blocks, so a spot's map pixel is
`(mapX + x/16) * 8 + (x%16)/2` and `(mapY + y/16 + 1) * 8 + (y%16)/2`. Samus is the room
she's in (`$7E:079B`) plus her position in it (`$7E:0AF6`, `$7E:0AFA`; 32 px to a map pixel).

## Files

- `index.html`, `js/app.js` — the page: the player, the layout, the autosave, the app bits
- `js/seed.js` — the New seed dialog; `gen/seed-worker.js` — DASH in a worker;
  `gen/dash-core.js`, `gen/patches/` — DASH (MIT, `gen/LICENSE-DASH.md`)
- `js/data.js` — presets and enums (written by `tools/sm-bundle.sh` from DASH), gear,
  bosses, locations, the memory map
- `js/map.js` — the map: the area maps drawn from the ROM, the pins, Samus, zoom and pan
- `js/tracker.js`, `js/store.js`, `hub.js` (the hub's glue), `sw.js`, `manifest.webmanifest`

To update DASH: `DASH=/path/to/dash-randomizer tools/sm-bundle.sh`, then
`python3 tools/sm-map-pins.py /path/to/sm.sfc` (a vanilla ROM) to redo the map pins.
