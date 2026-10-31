# Crowd effects (TikTok LIVE)

Viewers' gifts, likes, follows and shares change your game: hearts, magic,
rupees, bombs, arrows, inverted controls, no sword and more. The ROM is never
changed; any seed works.

It needs a bridge on the PC you stream from, which hears your LIVE and sends
the effects: **Crowd Control+** (Hank's, shared directly rather than as a
public download) or **JinxCast** (Snack OS). In the game: ⋯ menu → **Crowd
effects** → **Connect to** the one you run, and tick *TikTok effects on*.
The game's menu also has a test button for every effect, no bridge needed.

Not for races: this changes the game mid-run.

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
| `enemy_any` | Any enemy, anywhere: one of 74 enemies, its graphics loaded into the area first (the next screen loads its own again). Enemies already on screen keep theirs when possible | | | |
| `magic_small` | Small magic refill (¼ meter) | | | |
| `warp_dungeon` | Drop into a random dungeon's entrance (keeps the current dungeon's keys) | | | |
| `warp_flute` | Flute bird to a random flute spot (Light World outdoors; otherwise a random dungeon) | | | |
| `warp_random` | Flute spot or dungeon, 50/50 | | | |
| `insta_kill` | Instant death; the cape and Cane of Byrna don't block it (a bottled fairy still saves you) | | | |
| `shield_steal` | Shield stolen: gone until Link finds another (like a Pikit eating it) | | `shield_off` | Shield gone, 30 s: the same shield comes back at the end (a better one found meanwhile is kept) |
| `shield_down` / `shield_up` | Shield one step worse / better (Fighter's, Fire, Mirror); down stops at the Fighter's Shield | | `sword_off` | Sword gone, 30 s: the same sword comes back (one found meanwhile counts) |
| `heart_add` / `heart_remove` | +1 / −1 heart container for good (20 at most, never below 1); a new one fills itself |
| `tunic_up` / `tunic_down` | Tunic one step better / worse (green, blue, red mail), colors and all |
| `sword_up` | Sword one step better (Fighter's, Master, Tempered, Golden) | | `sword_down` | Sword downgrade, 30 s: one step worse, then back |
| | | | `master_sword` | Master Sword, 30 s: exactly the Master Sword whatever Link has (a gift with less, a curse with more), then his own sword back |
| `master_lock` / `master_unlock` | ⚠ Master Sword lock: the Master Sword for good. Swords found in the game are swallowed; only `sword_up` moves it (the lock moves with it); `sword_steal` takes the lock with the sword. Unlock lets go | | | |
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
