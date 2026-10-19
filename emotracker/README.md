# EmoTracker for the web (beta)

EmoTracker packs running inside Rando Hub: pick **Tracker → EmoTracker (beta)**.
Only the tracker itself is here: items, locations and their logic, maps,
layouts and autotracking. The desktop app's extras (NDI, Twitch chat, voice
control, notes, the Lua console) aren't part of it.

- `emo.js`: loads a pack (items, locations, maps, layouts, settings, variants),
  evaluates its access rules, runs its Lua scripts and memory watches, and
  autotracks from the emulator through Rando Hub's `AlttpBridge`.
- `ui.js`: draws the pack's layouts (container, dock, array, group, itemgrid,
  item, layout, map, recentpins, button_popup, tabbed, text, image, canvas),
  the map squares, location popups and pinned locations.
- `index.html`: the page, with a small menu (which tracker, which view, reset).
- `packs/alttpr_emosaru/`: the official ALTTPR pack. Its images' magenta
  (#FF00FF, which EmoTracker draws as transparent) was made transparent once,
  ahead of time (see `MAGENTA.txt` there); nothing else was changed.
  `files.json` lists the pack's files.

Marks are saved in the browser per game (a fingerprint of the ROM), so a new
seed starts clean.

## Credits and licenses

- **EmoTracker** by EmoSaru and the EmoTracker Community, MIT License
  (`LICENSE-EmoTracker.txt`). This is a new implementation in JavaScript; its
  behaviour (access rules, accessibility levels, item types, memory watches)
  follows EmoTracker's source.
- **Official ALTTPR pack** by EmoSaru, MIT License (`packs/alttpr_emosaru/LICENSE`).
- **Maps drawn from the game** (`romap.js`): the formats and tileset tables follow
  **zelda3** by snesrev, MIT License. No map pictures are shipped for this: they're
  drawn in the browser from the ROM being played.
- **fengari-web** (Lua 5.3 in JavaScript) by Benoit Giannangeli and Daurnimator,
  MIT License (`LICENSE-fengari-web.txt`).

Map and item images are from A Link to the Past (Nintendo), as used by the pack.
