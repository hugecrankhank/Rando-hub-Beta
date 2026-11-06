# SMZ3 Randomizer (Rando Hub)

Super Metroid and A Link to the Past in one game, items shuffled across both:
the **SMZ3 Randomizer** (v11.3.2, the generator behind samus.link) ported to
JavaScript, the hub's Snes9x, and a tracker that reads both games. One page,
nothing uploaded: your ROMs stay in your browser.

## What it does

- **Roll a seed** from your own two ROMs, the same two samus.link asks for:
  Super Metroid (Japan, USA; 3 MB, CRC32 `d63ed5f8`) and Zelda no Densetsu:
  Kamigami no Triforce (Japan) v1.0 (1 MB, CRC32 `3322effc`). A copier header
  is taken off. Every setting samus.link offers: Super Metroid logic (normal,
  hard), the goal, Ganon's Tower / Ganon crystals, Tourian bosses, first
  sword, Morph Ball, keysanity, race ROMs. A seed is a number (0–2147483647);
  a share code (`seed/settings`) carries both.
- **The same game as samus.link**: the generator is a line-by-line port of
  tewtal's C# (`gen/smz3gen.js`, MIT), .NET's `System.Random` included, so a
  seed and its settings place every item exactly as samus.link's v11.3.2 does.
  Checked: seed 321661004 with the default settings builds a ROM identical to
  the one samus.link made, byte for byte (but for the two random IDs it
  writes at `$80:FF60`); 96 more seeds over every setting all generate and
  pass the playthrough check.
- **The ROM** is built the way samus.link's page builds it: the two games
  merged into a 6 MB ExHiROM, the combo's base patch (`gen/zsm.ips`, from
  tewtal's alttp_sm_combo_randomizer_rom, MIT), the seed's changes, and the
  page's defaults (red hearts, half-speed heart beep).
- **Play** it right here (`../emu/`, the hub's Snes9x), **Download ROM**, or
  the **Spoiler** (the playthrough's spheres, prizes, medallions, every
  location). A seed from samus.link plays with **Play ROM file**.
- **Tracker**:
  - **Items**: Zelda's (swords, shields, mail, bow and silvers, boomerangs,
    rods, medallions, bottles, gloves…) and Super Metroid's (beams, suits,
    boots, tanks and ammo), read from the game, each with its picture: Zelda's
    are the hub's Zelda 3 tracker's own (`../tracker/items/`), Metroid's the
    hub's pixel icons (`js/icons.js`).
  - **Map** (`js/map.js`): the Light and Dark World (the Zelda 3 tracker's map
    pictures, with its check positions: the overworld's checks; the dungeons'
    are on their cards)
    and Super Metroid's six areas, drawn from the SM half of the ROM being
    played the way the game draws its pause map; a pin on every overworld and
    Metroid location, coloured by the logic, Link or Samus where they are
    (Follow switches to their world), pan / pinch / wheel zoom, ⟲ re-centre.
  - **Dungeons** (as Mudora's cards): each of the 13 with its prize (once the
    boss falls, or with Reveal), chests left, small keys in hand, big key, map
    and compass (read from the save block), and its boss; tap a card for its
    checks. Then the bosses: the ten dungeons' and Agahnim, Kraid, Phantoon,
    Draygon and Ridley, each with its prize (crystal, pendant or boss token)
    once it's beaten. The prizes, medallions and crystal counts are read from the ROM
    itself, so they're right for samus.link's seeds too.
  - **Checks**: all 316 locations by region, each ticked as the game marks it
    taken; coloured by SMZ3's own logic (green: reachable with what you have,
    keys aside).
  - **Seed**: the seed, its settings and share code; Reveal shows every
    location's item and the spoiler.
  - **Tracker** (the menu at the top of the column): which tracker shows the
    Zelda side, as the hub's Zelda 3 page offers them: **Mudora 2.0** (the
    default), **Mudora**, **Hutch**, Rando Hub's own SMZ3 tracker (both games,
    above), or off. The Zelda 3 trackers run in `z3host.html` inside the
    column: it answers their reads as if a plain Zelda 3 were running (the
    Zelda half of the combo put back in LoROM order for the ROM, Zelda's work
    RAM while Zelda runs, its last frame with the save block refreshed from
    the combo's save RAM while Super Metroid runs), so they autotrack the
    Zelda side as on the Zelda 3 page, pictures and maps cut from your ROM.
    Under it, the Metroid part of Rando Hub's tracker: Samus's items, the
    bosses and Zebes' map, so both games show at once. Mudora's item pictures
    are the game's own, cut from the plain Zelda ROM the seed was rolled from
    (the combo's Zelda half doesn't boot on its own), and the hub's run
    counters (checks, deaths, bonks, the GT big key game, the digging game)
    and small keys in hand reach them as on the Zelda 3 page
    (`../addons/hub-items.js`, run in the host). On a phone, Items /
    Light / Dark / Keys / Samus / Zebes above the frame pick what shows.
  - **Theme** (the ▲ Zelda / ◉ Metroid switch beside the Tracker menu): the
    menus, header, buttons and tracker in Hyrule's greens and gold or Zebes'
    navy and Samus's orange (`../combo-theme.js`, shared with Zelda 1 +
    Metroid). Hutch's grid is scaled to the column (and to the phone tabs:
    Items the grid, Light / Dark one world), as on the Zelda 3 page.
  - **Four windows for stream** (desktop, with a Zelda 3 tracker chosen):
    **⧉ Zelda items** (Mudora's items and dungeons), **⧉ Zelda maps** (both
    worlds), **⧉ Metroid items** and **⧉ Metroid map**, each in a window of
    its own for a separate capture; with Rando Hub's tracker, ⧉ Tracker and
    ⧉ Map as before.
  - **⧉ Tracker** and **⧉ Map** (desktop): each in a window of its own, for a
    second screen or a stream capture (`../game-popout.js`): the live tracker
    moves there, keeps autotracking, and comes back when the window closes.

## How the tracker reads the game

The combo runs one game at a time and keeps the other in save RAM
(`alttp_sm_combo_randomizer_rom/src/sram.asm`): `$A1:73FE` is the game
running (0 Zelda, `$FF` Super Metroid, else the credits). Zelda's save area is
WRAM `$7E:F000` in Zelda, SRAM `$A0:6000` otherwise; Super Metroid's items,
item bits and boss bits are WRAM `$7E:09A2` / `$7E:D870` / `$7E:D828` in
Metroid, its save slot at `$A1:6010` (+`$00`, +`$B0`, +`$68`) otherwise. Each
location's flag (Zelda's room word bit, overworld / NPC byte, or Metroid's
item bit) comes from the SMZ3 cas' fork's location table (TheTrackerCouncil,
MIT), matched by ROM address (`js/data.js`).

## Not here (yet)

- The maps (Hyrule and Zebes with a pin on every location): coming next.
- Multiworld.

## Files

- `gen/smz3gen.js` — the generator (port of Randomizer.SMZ3; the region files
  converted by a script, the rest by hand), `gen/texts.js` (its texts, from
  YAML), `gen/zsm.ips` (the combo base patch), the two MIT licences.
- `js/data.js` — the base ROMs, the location memory table.
- `js/seed.js` — the New seed dialog; `js/tracker.js` — the tracker; `js/map.js` — its map (`../world-map.js`); `js/icons.js` — Metroid's item icons.
- `js/z3pick.js` — the Tracker menu; `z3host.html` — the Zelda 3 trackers' host (the bridge and player they read).
- `js/app.js`, `js/store.js` — the player, saves, autosave (as `../smw/`).
