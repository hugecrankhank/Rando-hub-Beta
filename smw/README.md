# Super Mario World Randomizer (Rando Hub)

The [SMW Randomizer](https://github.com/authorblues/smwrandomizer) (v2.2, by
authorblues and kaizoman666, MIT) with the hub's Snes9x and a tracker that reads
the game. One page, nothing uploaded: the ROM stays in your browser.

## What it does

- **Roll a seed** from your own Super Mario World (USA) ROM (512 KB `.sfc`,
  headerless CRC32 `b19ed489`; a copier header is taken off). The generator is
  the randomizer's own code, unchanged (`gen/`), run in a hidden frame; its
  options are read from its own form, so every setting it has is here:
  - the **presets** (Gnarly, the easiest, through Way Cool, Awesome, Groovy,
    Mondo and Outrageous, to Funky, the hardcore one) or *Custom*;
  - every option, grouped as on its site: stages, level names, enemies, bosses,
    Bowser's Castle, power-ups, stage properties, physics, saving, other;
  - a **share code** (`seed/preset`, as the site's `#!/seed/preset` links) to
    play the same seed as someone else.
  A seed and its settings always make the same game. A seed the randomizer
  rejects is rolled again with a new number (up to 8 times).
- **Play** it right here (`../z1r/emu/`, the hub's Snes9x) or **Download ROM**.
- **Tracker**:
  - **Levels**: every stage, world by world, with a tick for each exit
    (normal and secret). The game sets an event flag for each exit it counts
    (`$1F02`, one bit per event; the ROM's table at `$05:D608` gives each
    level's event), so the exits tick themselves; a tap ticks one by hand.
  - **Bosses**: the four switch palaces (`$1F27–$1F2A`), the seven Koopa Kids'
    castles (each castle's exit) and Bowser (by hand, or the ending).
  - the exit count out of 96 (`$1F2E` and the ticks), lives and coins.
  - **Seed**: the seed, the preset, the share code, the ROM's checksum.
- **Play ROM file**: a seed from smwrandomizer.com, another randomizer or a hack
  plays too; the exits still tick (the game's own flags).
- **Autosave** through `../game-health.js` (the game's frame counter `$13/$14`
  tells a crash from a pause), **Continue** the last seed, pop-out tracker for a
  second screen or stream capture, the stream timer (stops when Bowser falls).

## Not here (yet)

- The overworld map with a pin on every level and Mario on it (drawn from the
  ROM, like the other games' maps): coming next.

## Files

- `gen/` — the randomizer (its `index.html` as `gen.html`, its scripts, jQuery
  and Bootstrap). The ROM that came with its repository is **not** included.
- `js/data.js` — stages, exits, castles, palaces, RAM addresses.
- `js/seed.js` — the seed dialog (the generator's own options, mirrored).
- `js/tracker.js` — the tracker.
- `js/app.js`, `js/store.js` — the player, saves, autosave (as `../sm/`).
