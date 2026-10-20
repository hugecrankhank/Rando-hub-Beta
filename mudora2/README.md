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
- **Everything else** is Mudora's: `../mudora/mudora.js` (with `MUDORA_LOGIC = 'mfns'`, so
  Hutch's tracker isn't read) and `../mudora/ui.js`.

Not yet: entrance shuffle on the map (his own tracker does it: the "Muffins' tracker"
button).

Problems with the logic: Muffins (his Discord). Problems with how it's shown: Rando Hub.
