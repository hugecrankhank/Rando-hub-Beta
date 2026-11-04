# Metroid Randomizer (Rando Hub)

Rando Hub's own item randomizer for **Metroid** (NES, 1986), with the hub's NES
emulator, a tracker that reads the game, and the world map. One page, nothing
uploaded: the ROM stays in your browser.

## What it does

- **Roll a seed** from your own Metroid (USA) ROM (128 KB `.nes`, CRC32
  `a2c89cb9`). All 38 power-up spots are shuffled: Bombs, High Jump, Screw
  Attack, Varia, Long / Wave / Ice Beam (the beams respawn, as in the game),
  8 Energy Tanks and 21 missile packs. A seed number (1–999999) and the settings
  always make the same game.
- **Start with Maru Mari** (default on): Samus begins with it and its spot left
  of the start holds something else. Off: Maru Mari stays where it always was.
- **Logic**: an assumed fill with careful rules (`js/data.js` SPOTS; no bomb
  jumps, wall jumps or door tricks): Bombs are always in Brinstar, Kraid's and
  Ridley's lairs need missiles, the deep Norfair / Ridley spots need High Jump or
  Ice, Tourian needs both statues, Bombs, missiles and Ice. Every seed is walked
  through once more before it's handed out.
- **Play** it right here (`../z1r/emu/`, the hub's FCEUmm) or **Download ROM**,
  plus a **Spoiler** (what's where, and the spheres).
- **Tracker**: gear, tanks, missiles, energy, the two statues, and every spot by
  area. The game records each unique item it hands out (`$6887..` as type + map
  square), so the spots tick themselves; beams don't, so those are ticked by
  hand. With the seed's placement known, spots are coloured: green = reachable
  with what Samus has, red = not yet; "Way out" says whether Kraid, Ridley and
  Tourian are open. Reveal (off by default) shows what every spot holds.
- **Map**: the game's own 32 × 32 world map (`$A53E` in the title bank), one
  area per tab (Tourian's squares overlap Brinstar's, so each area is drawn on
  its own), a pin on every spot, the elevators, Samus's square, pan / pinch /
  wheel zoom, Follow.
- **Play ROM file**: a seed from another Metroid randomizer or a hack plays
  too; the spots still tick (the game's own records), without the logic colours.

## How the ROM is changed

Each area bank keeps a table of special items per map square (`$9598` points
to it): a power-up is `02 type pos`. The randomizer rewrites the type byte of
every spot (`js/data.js` SPOTS has each file offset); the game draws, awards
and remembers the new item by itself. Two more bytes:

- the iNES header's battery bit, so the emulator exposes the cartridge RAM
  (`$6000–$7FFF`: Samus's gear, the taken items) to the tracker;
- with *Start with Maru Mari*, the new-game routine (`InitializeStats`, bank 0
  `$9354`) jumps to a 10-byte stub at `$BFE0` that also sets the Maru Mari bit.

Worked out with the ZaneDubya / Dirty McDingus disassembly of the game.

## Files

`index.html` the page · `js/data.js` the tables (spots, rules, map squares,
memory) · `js/logic.js` reachability · `js/randomizer.js` the fill and the ROM
patching · `js/seed.js` the New seed dialog · `js/tracker.js` · `js/map.js` ·
`js/app.js` the emulator, layout and autosave (`../game-health.js`) · `hub.js`
the links to the other games · `store.js` IndexedDB (`m1r`) · `sw.js`,
`manifest.webmanifest`, `icons/` the installable app.
