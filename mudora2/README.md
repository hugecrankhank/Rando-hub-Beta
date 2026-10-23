# Mudora 2.0

Mudora's look with Muffins' logic (his tracker is MIT licensed: `../mfns-tracker/LICENSE`).

- **Logic and settings:** Muffins' Tracker 2.0 (KrisDavie/alttptracker, `react_rewrite`),
  built unchanged into `../mfns-tracker/app/` and run in a frame on this page. His
  launch page picks the settings; after launch his tracker keeps running out of sight.
  `mudora2.js` reads his tracker's state (found by `../mfns-tracker/embed.js`) and sends
  clicks back as the same actions his own buttons send. Nothing of his is changed.
- **Squares:** which places each map square holds, and where his squares are, come from
  his data (`../mfns-tracker/data.json`, made by `../tools/mfns-extract.ts` from his
  source at the commit in `../mfns-tracker/COMMIT`). Where each is drawn is moved to the
  game's own door / item spot from the ROM (the `AT` table), as in Mudora 1.
- **Settings mid-game:** ⚙ Settings shows the choices of his launch page (read from his
  source into `../mfns-tracker/settings.json` by `../tools/mfns-settings.py`) for the game
  in progress, and sends changes with his own `setSettings` action. The ones his
  launcher remembers for every game (logic breaks and a few more) are saved to his
  launcher prefs too, as his launch page would.
- **Everything else** is Mudora's: `../mudora/mudora.js` (with `MUDORA_LOGIC = 'mfns'`, so
  Hutch's tracker isn't read) and `../mudora/ui.js`.

Not yet: entrance shuffle on the map (his own tracker does it: the "Muffins' tracker"
button).

Problems with the logic: Muffins (his Discord). Problems with how it's shown: Rando Hub.

## Entrances

On entrance-shuffle seeds (his Entrance Mode, in ⚙ Settings) the shuffled doors and holes
are drawn where they are in the game, with his rules for which show (from his source,
in `data.json`'s `ent`) and his colours. `../mudora/entrack.js` watches the emulator: when
Link goes through a door it reads that door's row of the game's entrance table (or, on
the way out, that exit's row) and links it with his own `setEntranceLink`, as his menu
would. Right click: his destination list (from his entrance menu's source, in
`settings.json`), "Pick on map…", or his own menu.

## New seeds

When the hub starts a seed it rolled itself, it writes the seed's settings to
`localStorage['rhb-seed-tracker']` (index.html, `playRom`). Mudora 2.0 then starts
a new game on Muffins' launch page and sends his `trackerSettings/setSettings`
with the matching values (`Mudora2.fromSeed` in mudora2.js). Each seed is set up
once (`rhb-mudora2-seed`); seeds loaded from a file are left alone.
