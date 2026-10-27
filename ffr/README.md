# ffr/ — the Final Fantasy randomizers: FF1R, FF4 Free Enterprise, FF5 Career Day

Three pages on one shared engine (`common/`), siblings of `ff6wc/`:

| Page | Randomizer | Rolled at | Emulator |
| --- | --- | --- | --- |
| `ff1/` | Final Fantasy Randomizer (NES) | finalfantasyrandomizer.com (generates in your browser there) | the hub's FCEUmm (`z1r/emu/`) |
| `ff4/` | FF4 Free Enterprise | ff4fe.com (patches in your browser there) | the hub's Snes9x (`emu/`) |
| `ff5/` | FF5 Career Day | bigbridge.studio/careerday | the hub's Snes9x |

Seeds are rolled on each randomizer's own site, then **Play ROM file** here: the
ROM is kept in this browser (Continue brings it back), saves and states stay here,
and the tracker reads the running game's memory.

## Each page

- `index.html` is built from `common/page.tpl.html` + the page's `page.json` by
  `python3 common/build-pages.py` (run it after editing the template or a page.json).
- `game.js` is the game's config (`window.FFGame`): the tracker's sections and how
  each item is read from memory (`read(mem)`, mem = `{ wram, sram }`), the stats
  line, when memory holds a real game (`started`), the generator's link and
  steps, and for FE how to read the seed's metadata out of the ROM (`readMeta`).

## What each tracker reads

- **FF1R:** the party's state lives in the cart's battery RAM ($6000–$63FF; the
  randomizer's own `unsram` symbols): key items one byte each at $6021 (Lute) …
  $6031 (Canoe), orbs $6032–$6035 (Fire, Water, Air, Earth; Shard Hunt counts
  shards in the Earth slot), ship $6000 / airship $6004 / bridge $6008 / canal $600C,
  gold $601C.
- **Free Enterprise (5.x):** the tracker block FE writes at $7E:1500 (as read by
  Kyuuden's Rando Companion): key items found (+$00) and used (+$03), bosses
  beaten by boss id (+$06), characters found by actor (+$10), objective task
  progress one byte per task (+$30) and group progress (+$50), key item check
  count (+$76), victory (+$1F); chests at $12A0–$12DF; party at $1000. The seed,
  flags and objectives are JSON the generator stores at $1FF000/$1FF004 (FE 5 zips
  it and points there), decoded with `randomizer/zip.js`.
- **Career Day:** key items one bit each from $7E:0A4A (its `reward_manager.asm`),
  jobs at $0840–$0842 (Knight = $0840 bit $80, then down), and each check's event
  flag from its `tables/arch_event.csv` (crystals, espers, songs, NPC rewards, and
  the bosses that hand out key items; a few flags clear when done).

## Layout

The same rule as FF6: the picture gets exactly its size (8:7, or 4:3 if the player
is set so) and the tracker the rest; upright screens stack them; narrow trackers
show one tab at a time; the game links fold into a **Games ▾** dropdown on narrow
headers.
