# Crowd effects (TikTok LIVE)

Viewers' gifts, likes, follows and shares change your game: hearts, magic,
rupees, bombs, arrows, inverted controls, no sword and more. The ROM is never
changed; any seed works.

```
TikTok LIVE ──► your LIVE page (Chrome/Edge) ──► Crowd Control+ ──ws://localhost:21214──► game page ──► Snes9x RAM / buttons
```

- `effects.js` runs in the game page. It queues effects and applies them only
  in normal play (not in menus, text boxes or screen transitions), about
  0.75 s apart, and shows a small feed and gift cards on the game picture.
- **Crowd Control+** (`crowd-plus/`, its own download) runs on the PC you stream
  from. It hears your LIVE through the **local signer** (recommended: your own LIVE
  page in a Chrome/Edge window it opens, read over Chrome's debugging connection,
  `crowd-plus/localsigner.mjs`) or, as a backup, TikFinity (free app), turns gifts into effects
  using `crowd-plus/mapping.json` (edited from its control panel), and runs the
  control panel and stream overlays.

The original panel-less bridge is retired and kept in `archive/crowd-control-standard`.

## Setup

1. Install Node.js 20 or newer. Have Chrome or Edge installed.
2. (Backup only) TikFinity (free, https://tikfinity.zerody.one), logged in, port 21213.
3. Double-click `Start Crowd Control+.bat` in the Crowd Control+ folder (or run
   `node bridge.mjs` there). The control panel opens at http://localhost:21214/studio.
   On its Dashboard, type your TikTok name and click Connect (local signer).
   Full steps: `crowd-plus/INSTRUCTIONS.txt`.
4. In the game on the **same PC**: ⋯ menu → **Crowd effects** → turn on, with
   the address `ws://localhost:21214`. The status line should say
   *connected*. If the browser asks to allow access to devices on your local
   network, allow it.
5. Set gifts up on the control panel's **Gifts & effects** tab, then go live.

Every gift that arrives shows in the control panel's log with its exact name,
even unmapped ones, with a one-click "add".

## Testing without going live

- `Test mode (no TikTok).bat`, then type `gift Rose 3`, `like 600`, `follow`, or an
  effect id like `invert` in the black window.
- The game's ⋯ menu → Crowd effects has a test button for every effect (no
  Crowd Control+ needed), plus "Test one boss".
- The control panel has the same: **Gifts & effects → Test any effect**, and
  **Live games → Test one boss**.

## Effects

| id | effect | | id | effect (timed) |
|---|---|---|---|---|
| `heal_full` | Full heal | | `invert` | Inverted D-pad, 20 s |
| `heal_1` | +1 heart | | `no_sword` | No sword, 20 s |
| `hurt_2` | −2 hearts (never kills) | | `no_item` | No Y item, 20 s |
| `hp_1` | Down to 1 heart | | `swap_by` | B and Y swapped, 20 s |
| `magic_full` / `magic_drain` | Refill / drain magic | | `one_hit` | One-hit KO: any hit kills, whatever mail Link wears (a fairy or the cape still save him), 30 s |
| `rupees_plus` / `rupees_minus` | ±50 rupees | | `no_magic` | Magic locked, 30 s |
| `bombs_plus` / `bombs_none` | +10 / lose all bombs | | `ice` | Ice physics (slippery floors everywhere), 20 s |
| `enemy_spawn` | Extra enemy (copies one already in the room) | | | |
| `enemy_random` | Random enemy that fits the area's loaded graphics (sheet needs from Enemizer) | | | |
| `magic_small` | Small magic refill (¼ meter) | | | |
| `warp_dungeon` | Drop into a random dungeon's entrance (keeps the current dungeon's keys) | | | |
| `warp_flute` | Flute bird to a random flute spot (Light World outdoors; otherwise a random dungeon) | | | |
| `warp_random` | Flute spot or dungeon, 50/50 | | | |
| `insta_kill` | Instant death; the cape and Cane of Byrna don't block it (a bottled fairy still saves you) | | | |
| `shield_steal` | Shield stolen: gone until Link finds another (like a Pikit eating it) | | `shield_off` | Shield gone, 30 s: the same shield comes back at the end (a better one found meanwhile is kept) |
| `shield_down` / `shield_up` | Shield one step worse / better (Fighter's, Fire, Mirror); down stops at the Fighter's Shield | | `sword_off` | Sword gone, 30 s: the same sword comes back (one found meanwhile counts) |
| `sword_up` | Sword one step better (Fighter's, Master, Tempered, Golden) | | `sword_down` | Sword downgrade, 30 s: one step worse, then back |
| | | | `item_off` | Item gone, 30 s: a random item Link has (any item-menu item, all bottles as one, gloves, boots, flippers or Moon Pearl) is gone, then back. Y does nothing while it's the equipped one |
| `sword_steal` | ⚠ Sword stolen: gone until Link finds another. **Can make a seed unbeatable** (no sword left to find); Crowd Control+ asks before it's put on a gift | | | |
| `seed_preset` / `seed_chaos` | Random preset / CHAOS seed (see below) | | | |
| `arrows_plus` / `arrows_none` | +10 / lose all arrows | | `cucco_storm` | Cucco attack: angry cuccos fly at Link, 30 s of outdoor time (the clock pauses indoors) |

**Screen, speed and Link** (new in 1.1.0; the emulator does the screen and
speed ones, so they work on any seed):

| id | effect | | id | effect (timed) |
|---|---|---|---|---|
| `fairy` | Fairy in the first empty bottle | | `mirror` | Picture flipped left-right, 20 s |
| `bee_bottle` | Bee in the first empty bottle | | `upside_down` | Picture upside down, 15 s |
| `music_roulette` | A random song from the MSU-1 pack, right now | | `wobble` | Drunk wobble, 20 s |
| | | | `tiny` | Half-size picture, 20 s |
| | | | `crt` | Retro CRT filter, 30 s |
| | | | `speed_up` / `slow_mo` | 1.5x speed 20 s / half speed 15 s |
| | | | `freeze` | Link can't move, 3 s |
| | | | `pink_link` | Pink Link, 60 s |

**Room lights** (1.9.16)

| id | effect |
|---|---|
| `lights_on` | A dark room as bright as with all its torches lit, 60 s (the clock runs indoors only) |
| `lights_out` | Any room nearly black (no lamp cone), outdoors the screen dims, 30 s |

**Reveal** (1.9.15, HydeOut's idea)

| id | effect |
|---|---|
| `reveal_item` | Where one go-mode item is: a banner on the game, and a mark on Mudora 2.0's map. From the playthrough in the seed's spoiler; skips items Link has and spots already shown. Seeds made in the hub only (not race seeds). |

**Halloween** (1.9.13)

| id | effect |
|---|---|
| `spooky_night` | Every colour on screen but Link's turned purple and orange, 45 s |
| `ghost_link` / `pumpkin_link` | Pale ghostly Link / orange Link, 60 s |
| `haunted_lights` | Screen dims and flickers, a lightning flash now and then (at most one every ~2 s), 20 s |
| `spooky_monster` | A Poe, Keese, Gibdo, Stalfos, Stalfos Knight, Raven or Vulture near Link (flying ones outdoors only; a random enemy if none fits) |
| `haunting` | Three spooky monsters |
| `trick_or_treat` | 50/50: a treat or a trick effect |
| `spooky_sprite` | Random Halloween-ish sprite from the library (by name or tag) |
| `blood_drip` | Blood runs down from the top of the screen, 20 s |
| `spider_web` | Spiderwebs in the corners and a dangling spider, 30 s |
| `monster_mash` | Every enemy on screen becomes a bat or a mummy (another spooky monster where their graphics aren't loaded) |

**Boss detour** (new in 1.2.0): the game saves itself, drops Link into a boss
fight, then loads that save when the fight ends (timer runs out, Link falls, or he
wins), so the run carries on exactly where it was. Length = `durations.boss_detour`
(default 60 s). Not for races.

| id | effect |
|---|---|
| `boss_ganon` | Ganon's fight (drop through the Pyramid hole) |
| `boss_aga` | Agahnim's first fight (Castle Tower top) |
| `boss_random` | A random boss not beaten yet in this run: Ganon, either Agahnim, or any dungeon boss |

**App rolls** (use the app's own buttons):

| id | effect |
|---|---|
| `sprite_roll` | Random sprite from the whole library (changes Link right away) |
| `sprite_fav` | Random sprite from your ★ favourites |
| `msu_roll` | Random MSU-1 pack from your ★ favourite packs |
| `seed_roll` | **New seed** with the current Randomizer settings — ends the current game |

`seed_roll` is off until you check **Allow seed reroll** in ⋯ menu → Crowd
effects. When it fires, a banner on the game shows who sent it and counts
down 10 seconds, then shows the seed being made and the result (with the
seed's code). A **Cancel new seed** button appears in that menu during the
countdown. The banner can be turned off there too. If a roll can't happen (no favourites
yet, no packs), the feed says so instead of popping up a dialog.

Timed effects count only time spent in play and stack (a second gift adds
time). `ice` and `cucco_storm` switch on features built into the randomizer
ROM itself; on a ROM without them the feed says so and nothing happens. They only filter buttons or hold a value each frame, so save states,
resets and reloads can't leave the game stuck changed.

## Seed rolls by coins

`coinTiers` in mapping.json: a donation worth at least that many coins (gift
value × streak count) does that effect instead of the gift's own; the highest
tier reached wins. Defaults: 1000 `seed_roll` (same settings), 1200
`seed_preset` (a random preset from Saved presets: your ★ ones if any, else
all but glitched-logic ones), 2000 `seed_chaos` (random generator, every menu
randomized except glitched logic, race, AVIANART timer modes and Kara's
damage challenge; up to 3 tries). The randomizer side is
`window.UnifiedRando.crowd` in `randomizer/app.js`.

## Subathon clock

The bridge keeps a countdown (`timer-state.json`, restored paused on restart).
Control page: `http://localhost:21214/timer/control` (set, start, pause,
adjust; it sends an `x-ccbridge` header, which other sites can't). Every coin
adds `1 / timer.coinsPerSecond` seconds (fractions carry over between donations;
the older `secondsPerCoin` still works) while the clock is set and not finished.
It shows on the game (bottom centre, can be turned off in Crowd effects) and
as an OBS source at `/timer` (`?size=`, `?bg=0`, `?label=0`).

## Scrolling gift list (OBS)

While the bridge runs, `http://localhost:21214/ticker` is a scrolling bar of
every mapped gift and its effect, for an OBS browser source or a TikTok LIVE
Studio link source. `?height=`, `?speed=` and `?bg=0` adjust it. Gift
pictures come from `crowd-plus/icons/<Gift name>.png`.

## mapping.json

- `gifts`: gift name (any case) or gift id → effect id.
- `likes`: `{ "every": 300, "effect": "heal_1" }` fires once per 300 likes.
- `follow`, `share`: effect id; once per viewer per 10 minutes.
- `durations`: seconds for timed effects, e.g. `{ "one_hit": 20 }`.
- `ticker`: `title`, `speed`, and `labels` (nicer effect names) for the gift list.
- `maxPerGift`: cap for a gift streak (e.g. 20 Roses still gives 5 heals).
- `source`: `"tikfinity"` (default) or `"direct"`. Direct mode connects to
  TikTok without TikFinity, using `tiktok-live-connector` and needs `username`,
  `signServer` (`"euler"` or an `https://` sign server) and a paid
  `signApiKey`.
- `port`: the bridge's own port (default 21214; 21213 is TikFinity's).
- `allowedOrigins`: pages allowed to connect to the bridge.

## Good to know

- **Phone play:** a page on `https://` can only reach `ws://localhost`, so the
  game must run on the PC with the bridge. To play on a phone, put the bridge
  behind an `https` tunnel (for example
  `cloudflared tunnel --url http://localhost:21214`) and set the menu's bridge
  address to the `wss://…` address it prints, and add the game's origin to
  `allowedOrigins` if you open it from somewhere else.
- **TikTok connection:** TikTok requires every LIVE connection to be signed by
  an outside sign server. Euler Stream (used by `tiktok-live-connector`) and
  tik.tools both charge for this now, which is why the default goes through
  TikFinity, which handles the TikTok side for free.
- Not for races: this changes the game mid-run.
