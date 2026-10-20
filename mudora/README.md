# Mudora

Rando Hub's own tracker (beta), named after the Book of Mudora.

- **Logic** is Hutch's ALTTPR tracker (MIT, `../tracker/LICENSE`), unchanged. Rando
  Hub runs his item tracker and map out of sight; Mudora reads their answers
  (`checkColor`, `dungeonColor`, `checkState`, the `alttp-tracker` BroadcastChannel
  item snapshot) and sends clicks back the same way. None of his pictures are used.
- **Pictures** come from the game being played:
  - `iconworker.js`: a hidden Snes9x opens the game's pause menu with a full
    inventory and cuts out each item (works for vanilla and randomizer menus).
  - `../emotracker/romap.js`: the Light and Dark World, drawn from the ROM.
  - `../emotracker/dungeons.js` and `dgworker.js`: dungeon maps.
- **Check positions** (`CHECK_AT` in `mudora.js`) are the game's own door, hole and
  sprite positions, read from the ROM, matched to Hutch's checks.

Files: `index.html` (layout), `mudora.js` (link to Hutch's logic, pictures, game
fingerprint), `ui.js` (what's drawn), `iconworker.js` (item icons).
