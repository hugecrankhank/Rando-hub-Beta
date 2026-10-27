# Muffins' Tracker 2.0 in Rando Hub: the logic library

**The logic is Muffins' (MFNS / KrisDavie):** https://github.com/KrisDavie/alttptracker
(`react_rewrite` branch), also at https://volatile.alttprtracker.mfns.dev/. Used with
his permission and under his MIT license (`LICENSE`, copied from his repo). Bugs in the
logic itself → his Discord. Bugs in how Rando Hub runs it → Rando Hub.

Mudora 2.0 (`../mudora2/`) is Mudora's look with his logic. Until 1.14.4 his whole
tracker ran out of sight in a frame; now his source is built as a **library**:

- `lib/mfns.js`: his logic engine, his Redux store (reducers, actions), his data
  tables (locations, dungeons, items, presets, SRAM map) and his sessions
  (IndexedDB), bundled from his source **unchanged** with one entry file of ours
  (`../tools/mfns-lib/entry.ts`) and a Vite config (`vite.lib.config.ts`). No React,
  no pages. The entry file adds the four things his React components used to do:
  make the store for a session, start a session the way his launcher does, run his
  LogicProvider's recompute as a subscription, and run his AutotrackerProvider's
  processing on memory the hub reads from its emulator.
- `lib/SOURCE_COMMIT`: his commit it was built from.
- `data.json`: his map squares and dungeon lists (`../tools/mfns-extract.ts`);
  `settings.json`: his launch page's settings and presets (`../tools/mfns-settings.py`).

Built by `.github/workflows/mfns-lib.yml` (run it by hand with a newer commit of
his to update; it also refreshes `data.json` and `settings.json`). Every Monday the
workflow checks whether his branch has moved and opens an issue with the compare
link, so his logic changes are taken deliberately, one diff at a time.

Sessions are shared with his own tracker: a game started in Rando Hub shows in his
session list at the same address, and the other way round (same IndexedDB, same keys).
