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

## Entrances

`entrances.json` (made by `../tools/entrances.py` from the ROM and Kara's generator's
entrance tables): every overworld door and hole by its entrance-randomizer name, where
it is, and its slot in the game's entrance tables. `entrack.js` watches the emulator and,
when Link goes through a door, reads only that door's row to see where it led (on the way
out: that exit's row), then tells the page. Mudora gives it to Hutch's map: his code for
what's inside (dungeon, shop, item cave and so on), or a connector between the two doors
of a cave once both are known. His entrance markers are drawn at the real doors, in his
colours; right click offers his codes and connectors.
