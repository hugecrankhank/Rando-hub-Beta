# Adding a game to Rando Hub

A checklist for every new game page (sm/, glr/, ffr/… are the models).
Things here were learned the hard way; each line says why.

## Required

- **Autosave through `game-health.js`, never on its own.** Copy the autosave
  block from `sm/js/app.js` (`RHHealth.create`, `RHHealth.push`,
  `RHHealth.restore`) and load `../game-health.js` before the page's app.js.
  A crashed game must never become the autosave: in Nov 2026 a Super Metroid
  crash (music still playing, picture frozen) got autosaved, so every reload
  came back frozen. The guard only snapshots while the game is running, keeps
  the last three good snapshots (at least a minute apart) and, on Continue,
  falls back past frozen ones, then to a restart (in-game saves are kept).
  - Give it the game's **main-loop frame counter** when one is known
    (`counter: (ram) => …`): it stops when the game crashes even if the music
    keeps going, which is what the generic check can miss. Known: Super
    Metroid `$7E:05B6`, Zelda 3 `$7E:001A`. Without one, the whole work RAM
    is watched (enough for a jammed CPU).
  - Test it: load a ROM, wait 22 s (a snapshot), freeze the RAM view
    (`core.wram = () => copy`), check no new snapshot and the "seems to have
    frozen" toast, then Continue.
- The credits screen (`credits-splash.js`) comes with the emulators' player.js: a
  new game on another emulator must show it before booting too.
- `../ios-audio.js` comes with the emulator's audio.js (iPhone: no Now
  Playing card left behind).
- `../game-header.js`, `../run-timer.js` (stream timer), `../cursor-hide.js`,
  `../web-update.js` with `data-hub="../"`, and the Games menu
  (`roll-games.js`) like the other pages.
- Add the page's new files to `offline-files.json` (and its `sw.js`).
- Crowd effects: written in the private Crowd Control+ repo (`effects/`) and
  synced in with its `sync-effects.py`; use Zelda 3's effect ids where an
  effect means the same thing.
- Layouts: make the most of the screen on iPad, iPhone and tablets.
