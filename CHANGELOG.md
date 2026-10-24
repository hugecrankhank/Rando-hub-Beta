# Changelog

Every version is also kept as a download on the
[Releases page](https://github.com/hugecrankhank/Rando-hub/releases): a zip
with the whole app, crowd control and instructions, so any version can be
played again later.

## Beta v1.10.0 (2026-10-24)

- **Zelda 1 seeds: ZORA 2.0 beta 8** (from beta 5). Nearly every setting in the New seed
  popup can now be chosen: 13 choices across 7 settings are still "Not produced by ZORA
  yet", down from 275 across 77. That includes vanilla dungeon room layouts (Dungeon Room
  Shuffle: Vanilla), Level 9 entry and triforce counts, armos / coast / white sword items,
  starting items and hearts, swords, hint types, OHKO, Permanent Sword Beam and more, plus
  a "Vanilla" preset. Same popup and look.
- **Mudora: the boots showed a hammer** (HydeOut). Finding the boots' picture in the
  pause menu took away the hammer ($7EF34B) instead of the boots ($7EF355). Fixed;
  Mudora draws its pictures again once.

## Beta v1.9.20 (2026-10-24)

- **More Halloween effects** (Crowd Control+ 1.9.20): *Blood drip* (blood runs down from the
  top of the game screen, 20 s), *Spiderwebs* (webs in three corners and a spider on its
  thread, 30 s) and *Monster mash* (every ordinary enemy on screen turns into a bat or a
  mummy, or another spooky monster where those graphics aren't loaded; they keep their
  place and their slot in the room). All three can come up in Trick or treat.

## Beta v1.9.19 (2026-10-24)

- **One-hit KO** (Crowd Control+ 1.9.19): `one_hit` kills on any hit, green, blue or red
  mail alike (it used to only drop Link to one heart, so mail could let him survive).
  The hit's damage, after the mail, is turned into all of Link's hearts; a bottled fairy
  and the cape / Cane of Byrna still save him.

## Beta v1.9.18 (2026-10-23)

- **Seed type and settings under the seed code** (Randomizer bar): what kind of seed it
  was (Generate & Play, 🎲 Reroll, Crowd Control's random preset / CHAOS, the preset or
  pick, who rolled it), every setting the generator used (Kara's: all of them, defaults
  dimmed), and what the tracker was set to for it (Mudora 2.0: Muffins' settings), side by
  side, to check whether the tracker's logic matches the seed.
- **Scrolling gift list rows** (Crowd Control+ 1.9.18): 1-4 rows, each scrolling on its
  own, set on the Gifts & effects tab with the list's title and speed.
- **Gift order**: drag the gifts (or use ▲ ▼) on the Gifts & effects tab; the scrolling
  gift list shows them in that order.

## Beta v1.9.17 (2026-10-23)

- **Credits**: ⚙ Settings → Credits lists Rando Hub's playtesters (Gumby @gumby.oo7,
  HydeOutGaming @jennkevden, Heffie's Homies @heffie638), shout-outs (Hutch, Kara,
  Muffins) and what the hub builds on. They're also in the game's own ending on every
  seed made in the hub ("playtested by Gumby"…), in the ending's joke captions only, so
  the item-hint captions and the seeds themselves don't change.

## Beta v1.9.16 (2026-10-23)

- **Room lights** (Crowd Control+ 1.9.16): *Lights on!* lights up a dark room as if every
  torch were lit (60 s, waits for the next dungeon if given outside); *Lights out!* makes
  any room nearly black (30 s; outdoors the screen dims). Uses the game's own dark-room
  colour math, and the room's own lighting comes back when they end.

## Beta v1.9.15 (2026-10-23)

- **Reveal a go-mode item** (Crowd Control+ 1.9.15, HydeOut's idea): a gift shows where one
  item the run still needs is, from the seed's spoiler (its playthrough). Skips items Link
  already has and spots already shown; a banner on the game and a mark on Mudora 2.0's
  map. Seeds made in the hub only; race seeds keep their spoiler hidden.

## Beta v1.9.14 (2026-10-23)

- **Seed history**: every seed the hub starts (Zelda 3 and Zelda 1) is logged with when,
  the seed and its code, generator and preset, who rolled it and how (Generate & Play,
  🎲 Reroll, Crowd Control's new seed / random preset / CHAOS, or handed over from the
  other game) and a link to play it again. ⚙ Settings → Seed history, with Download
  (CSV). Crowd Control+ 1.9.14 keeps the same list on the streaming PC (seeds.json, Live
  games tab).

## Beta v1.9.13 (2026-10-23)

- **Halloween effects** (Crowd Control+ 1.9.13): Spooky night, Ghost Link, Pumpkin Link,
  Haunted lights, Spooky monster, Haunting (three monsters), Trick or treat and Spooky
  sprite. Link's colour effects (Pink, Ghost, Pumpkin) take turns instead of fighting.

## Beta v1.9.12 (2026-10-23)

- **Mudora 2.0 shows the check counter** (the game's own count, as in Mudora and the run
  stats overlay) next to Locations, Deaths and Bonks.

## Beta v1.9.11 (2026-10-23)

- **Digging Game guessing** (Crowd Control+ 1.9.11, Live games tab): chat guesses which
  dig gives the Digging Game's prize (`!dig 1-30`); the game reads the seed's dig number
  and says which it was when the prize is picked up. New "Digging Game" overlay.
- **The seed reroll banner moved to the top of the game** (over the HUD) so it no longer
  covers the play area.

## Beta v1.9.10 (2026-10-23)

- **Mudora's crystal pictures**: the crystal was found by taking away Misery Mire's,
  a red one, so the crystal came out red. It's now found with Palace of Darkness's
  (blue), and the red crystal is the game's own red one. Pictures are drawn again once.

## Beta v1.9.9 (2026-10-23)

- **Mudora's item pictures with the randomizer's newer pause menu**: boots, gloves,
  flippers and Moon Pearl showed as check marks, and pendants as pieces. Their place
  in the menu is now found from the game itself (the menu with and without each item)
  instead of fixed spots. Pictures are drawn again once.

## Beta v1.9.8 (2026-10-23)

- **Mudora and Mudora 2.0: a + on the red crystal and green pendant** in the dungeon
  list (red and green), so they can be told apart while still grayed out.

## Beta v1.9.7 (2026-10-23)

- **Mudora 2.0 is the default tracker** (anyone still on Mudora is moved over once;
  the Tracker menu still has every choice).
- **Mudora 2.0 follows each new seed**: a seed rolled in the hub (the bar, a reroll,
  a random preset or CHAOS seed from Crowd Control) starts a new game in Muffins'
  tracker with the seed's settings: world state, goal and crystals, logic, swords,
  dungeon item shuffle, entrance shuffle, boss/enemy shuffle, pottery, drops, shops,
  pseudoboots, mirror scroll, prizes and followers. A ROM loaded from a file keeps the
  game in progress.

## Beta v1.9.6 (2026-10-23)

- **Which rerolls can switch games** (with "Rerolls can land on either game"): Crowd
  Control's *New seed (same settings)* always stays in the game being played; *Random
  preset seed* and *CHAOS seed* can switch, and stay that kind in the other game (a
  random preset there). Zelda 1 gets Random preset and CHAOS seed effects too.
- **The scrolling gift list follows the game**: after a switch it lists only what the
  new game can do, with that game's names. Crowd Control+ 1.9.6.

## Beta v1.9.5 (2026-10-23)

- **Gift goals for one gift**: a gifts goal can count a single gift (like 50 Roses)
  instead of any gift. Pick the gift and how many on the Goals tab; the goal bar
  overlay shows that gift's picture and name. Crowd Control+ 1.9.5.

## Beta v1.9.4 (2026-10-23)

- **GT big key game counts 1-22**: only the places the big key can be (Bob's Torch and
  every GT chest except the Big Chest and the four behind the big key door), so the
  chest numbers match what chat can guess. Crowd Control+ 1.9.4 and the game both updated.

## Beta v1.9.3 (2026-10-23)

- **Crowd Control+ 1.9.3: comments add time to the subathon clock**, with an optional
  per-viewer wait so one viewer can't spam it up (control panel → Subathon).

## Beta v1.9.2 (2026-10-22)

- **Mudora 2.0: "Visible" (orange) checks.** Muffins' logic has no visible state, so
  items you can see but not reach yet (Lake Hylia Island, Lumberjack Tree, Zora's Ledge,
  Desert Ledge, Spectacle Rock, Floating Island, Bumper Cave Ledge) stayed red. Rando Hub
  now turns them orange using Hutch's rules for when each one is visible. Our addition,
  not Muffins' logic; off in inverted and entrance shuffle.
- **Fixed (Mudora, Mudora 2.0): the map and big key pictures were swapped** on the
  dungeon rows, so a dungeon's map lit up looking like its big key.
- Mudora's small-key count turns **green** once every key in the dungeon is found.
- **⚙ Settings in the header** holds the tracker settings: Tracker world and Tracker
  dungeon items (only shown with trackers that use Hutch's logic: Hutch's, Mudora,
  EmoTracker), Tracker keys and Item sounds. On iPad and phone headers they sit in
  the existing ⚙ menu.
- **Zelda 1 ▸** button in the header, next to Reroll.
- **Mudora 2.0 shows deaths, bonks and the GT big key game** (GT chests opened, and
  which one had the big key), read from the game like Mudora's.
- **Fixed: long press on a check selected text on iPad / iPhone** (Mudora, Mudora 2.0,
  EmoTracker). Holding a finger on a check opens its card again.
- **Fixed: a double tap zoomed the page in on iPad / iPhone** (Zelda 1 and Zelda 3),
  with no easy way back out.
- **Fixed: controller buttons couldn't be remapped one after another** (Zelda 1 and
  Zelda 3 emulators): only every other box took a press. Now each one does.
- **Crowd Control+ 1.9.2: the crowd adds time to the subathon clock.** Seconds for
  each like (down to 0.01), follow, share, new Super Fan and new community member,
  set on the control panel's Subathon tab. Likes add up until they make a whole second.
- **Effects and alerts for new Super Fans and new community members** (Gifts &
  effects and Alerts tabs), with test buttons.
- Item sounds and keys in hand on every tracker (below).

## Beta v1.9.1 (2026-10-22)

Everything below down to "Mudora 2.0 autotracking fix", plus Crowd Control+ 1.9.1
(the subathon clock fix). Download: Crowd-Control-Plus-v1.9.1.zip on this repository's
Releases page.

## Beta: item sounds and keys in hand on every tracker (2026-10-22)

- **Item sound packs now play with every tracker** (Hutch's, Mudora, Mudora 2.0,
  Muffins', EmoTracker): the hub reads new items straight from the game. Pick a
  pack, or import a pack folder, with the new **Item sounds** menu in the header.
  Hutch's broadcast view no longer plays pack sounds itself while the hub is
  open, so nothing plays twice.
- **Tracker keys** in the header: Found `1/6`, In hand `0/6` or Both `1(0)/6`,
  on Hutch's tracker, Mudora, Mudora 2.0 and EmoTracker. (Muffins' own tracker
  keeps its usual count; its code is his.)

## Beta: subathon clock fix (2026-10-22)

- **Fixed: the control panel's subathon clock ran fast.** It counted down about
  twice as fast as the real clock (one second, then a jump of two or three), so
  after a while it showed far less time than the game and the stream overlay.
  Only the control panel's display was wrong: the real clock, the clock on the
  game and the /timer overlay were right all along.

## Beta: Zelda 1 joins the hub (2026-10-22)

- **Zelda 1 (Z1R) is in the hub** at `z1r/`: roll, play and track Zelda 1
  randomizer seeds. Switch games from the new **Game** row at the top of the
  Randomizer bar; Zelda 1 has a **◂ Zelda 3** button to come back.
- **Rerolls can land on either game** (checkbox in the same row): the 🎲 Reroll
  button and Crowd Control's *New seed!* pick Zelda 3 or Zelda 1 at random,
  both ways. A Zelda 1 roll uses the flags last used in its New seed dialog;
  a Zelda 3 roll uses the Randomizer bar's settings.
- **Crowd Control in Zelda 1:** the same Crowd Control+ bridge and mapping.json.
  Effects that exist in both games keep their names; ALTTP-only ones are skipped
  while Zelda 1 is playing. On/off and the bridge address carry over from here.
- Zelda 1 needs your own Legend of Zelda (USA) ROM, picked once in its New seed
  dialog.

## Beta: item sound packs and keys in hand (2026-10-22)

- **Item sound packs.** A pack is a folder with one folder per item (hookshot,
  fire rod, master sword…) holding as many sounds as you like; every pickup plays
  one at random, never the same one twice in a row. In the broadcast view:
  **♪ Item Sounds → Sound Pack** to pick a pack, import a pack folder from your
  computer, or set the pack volume, and a **♪ Pack** button that steps through
  Off → each pack → Mix. Items a pack doesn't cover use your profile's sound.
  Built-in packs go in `sounds/packs/` (see the README there).
- **Crowd Control:** `sound_pack_next` and `sound_pack_random` switch the item
  sound pack from a gift.
- **Small keys in hand.** Item tracker ⚙ → Dungeon Background → **Small keys:**
  Found `1/6` (as before), In hand `0/6`, or Both `1(0)/6` — found, (in hand),
  total. In hand drops as you open doors; it's read from the game while
  autotracking.

## Beta: Mudora 2.0 autotracking fix (2026-10-22)

- **Fixed: autotracking looked dead after starting a game from a preset (or New game).**
  Muffins' tracker was tracking fine, but Mudora 2.0 kept showing the page it had
  before the new game, so nothing changed on the map. It now follows his new page
  as soon as it loads. (This is also why a preset seemed to need starting twice.)

## Beta: Mudora 2.0 autotracking details (2026-10-21)

- **⚙ Settings → Autotracking details:** what autotracking is doing right now (on/off,
  connection, the game mode and ROM name Muffins' tracker last read, how many reads,
  any errors on his page, and a log of anything the watchdog did). For a screenshot
  when autotracking doesn't pick things up.
- The watchdog now also notices when his tracker keeps reading but never gets as far
  as the items and checks while you're playing, logs why, and reloads his tracker.

## Beta: text boxes keep the dungeon map; autotracking self-repair (2026-10-20)

- **Text boxes and the pause menu** no longer flip Mudora's map back to the overworld
  while you're in a dungeon (the game is in its "message" mode then; Link hasn't moved).
- **Mudora 2.0 autotracking watchdog:** while you're playing (overworld or inside), Muffins'
  tracker reads the game a couple of times a second. If those reads stop for 8 seconds,
  Mudora 2.0 reloads his tracker on the same game ("Reconnecting autotracking…"), so
  nothing is lost.

## Beta: faster autotracking replies (2026-10-20)

- The built-in emulator now answers the trackers' memory reads straight away instead of
  waiting a turn per read, which mattered most on phones where the game keeps the page
  busy (a tracker reads a dozen ranges per update). It also handles one-shot listeners
  the way a real connection does. Both Hutch's and Muffins' trackers checked after.

## Beta: Mudora 2.0 launch and autotracking fixes (2026-10-20)

- **Presets/Launch needing two tries:** launching saves the new game first, and with the
  game running that took several seconds with nothing on screen, so it looked like the
  first click did nothing (and a second click started a second game). Launch now shows
  "Launching…" straight away and ignores repeat clicks.
- **Autotracking:** Muffins' tracker is now always pointed at Rando Hub's emulator (a
  leftover SNI choice from his launch page could leave it unconnected). Mudora 2.0's
  status line says whether autotracking is on, waiting for the game, or switched off,
  and ⚙ Settings has an Autotracking switch.

## Beta: dungeon maps without the magic meter (2026-10-20)

- **Explore dungeon maps** no longer pick up the magic meter: it was copied from the game's
  screen with each room, and smeared into a long bar in rooms that scroll. Rooms already
  drawn with it are dropped once and drawn again, clean, on your next visit. (Map and
  Full modes weren't affected.)

## Beta: Mudora on phones: more room for the map (2026-10-20)

- The options (dungeon maps, item size, grid, Settings, Reset maps, help, and on Mudora 2.0
  Muffins' tracker / New game) and the colour key now sit behind the ⚙ at the bottom
  right and open over the map instead of pushing it down; tap anywhere else to close
  them. The map gets the whole width.
- Entrance tags (where each door leads) show once you zoom in a little, so the zoomed-out
  map isn't covered in labels.

## Beta: Mudora 2.0 presets in Settings (2026-10-20)

- **⚙ Settings → New game from a preset:** pick any of Muffins' presets (OnlyADKD is
  "ADKDF") and Start: his launch page picks it and launches for you, so the preset's
  known entrances and left-out checks come with it. (On his launch page the "ADKDF" next
  to the Tournament Presets title is a Discord link; the preset is the button below.)

## Beta: entrance tracking in Mudora and Mudora 2.0 (2026-10-20)

- **Entrances on the map:** on entrance-shuffle seeds every shuffled door and hole shows at
  its real spot in the game (from the ROM), in its tracker's logic colour, with a tag for
  where it leads. Mudora uses Hutch's entrance system, Mudora 2.0 uses Muffins' (set his
  Entrance Mode in ⚙ Settings); each stays in step with its own tracker.
- **Automatic:** walk through a door (or drop down a hole) and Rando Hub reads where it
  took you from the game and fills it in, the same way items are autotracked. Leaving a
  cave by another exit fills in that door too, and in Mudora the two doors of a cave get
  joined with a connector. Only the door you used is read, so nothing is given away
  early. (Checked against a full entrance-shuffle seed from Kara's generator: every door
  matched its spoiler.)
- **By hand:** click an entrance to mark it done; right click (hold on a phone) to set
  where it leads: Hutch's codes in Mudora, Muffins' destination list in Mudora 2.0 (his
  rules for which can go where), "Pick on map…" to point at another entrance, Clear, and
  in Mudora a connector to another door. Mudora 2.0's "Muffins' menu" opens his own
  menu for connectors, notes and scouting.

## Beta: Mudora 2.0 settings mid-game (2026-10-20)

- **⚙ Settings** in Mudora 2.0's bar: all of Muffins' game and logic settings (world
  state, logic mode, goal, crystals, keys, pottery, shuffles, logic breaks and his two
  logic-related tracker options), changeable any time, mid-game too. The logic updates
  straight away and the settings stay with the game. The choices are read from his own
  launch page's source (`tools/mfns-settings.py`), so they match his.

## Beta: Mudora map controls (2026-10-20)

Suggestions from HydeOutGaming, for Mudora and Mudora 2.0:

- **Reset maps:** a ⟲ button on each world map, and "Reset maps" at the top, put the
  maps back as they started (whole world, no zoom), so a stream layout can be restored.
- **A map can't be lost any more:** dragging keeps part of the world on screen, and a
  broken zoom snaps back to the whole world.
- **Clicking a check marks it done** (click again to open it again). Right click (hold
  on a phone) opens its card to mark which item is there, and in Mudora 2.0 to tick
  off the places in a square one by one. Nothing pops up on mouse-over any more.

## Beta: Muffins' Tracker 2.0 and Mudora 2.0 (2026-10-20)

- **Tracker → Muffins Tracker 2.0 (beta):** Muffins' (MFNS) new tracker, with his
  permission, built unchanged from his `react_rewrite` source and run inside Rando Hub:
  his launch page, presets and settings, his logic, maps and layouts. Autotracking
  comes from the built-in emulator. Tip: his Map mode "Vertical" suits the side
  panel. Under his MIT license (`mfns-tracker/LICENSE`), now offered to everyone.
- **Tracker → Mudora 2.0 (beta, Muffins logic):** Mudora's look (the game's own items,
  maps drawn from the ROM, dungeon maps, squares moved onto the game's real door and
  item spots) with Muffins' logic and settings. Pick settings on his launch page (it
  opens inside Mudora 2.0; "Muffins' tracker" and "New game" bring it back), then his
  tracker runs out of sight and Mudora 2.0 shows its answers and sends clicks back as
  his own buttons do. His squares hold several places each: the card lists them to
  tick off one by one, and a darker green means some are available. Entrance shuffle
  isn't drawn yet (use his tracker for that).
  Logic problems: Muffins' Discord; how it looks here: Rando Hub.
- **Mudora: Full dungeon maps** now draw (the page was looking for the drawing worker
  in its own folder).

## Beta: fixes (2026-10-19)

- **Boss detour to Thieves' Town: Blind now appears.** He only shows up after the
  maiden has turned into him (a flag on his room) and with no maiden following Link;
  the detour now sets that for the trip (the save state puts it back afterwards).
  Tested on a vanilla and a randomized ROM: Blind spawns in his room.

## Beta: Mudora (2026-10-19)

- **Tracker → Mudora (beta):** Rando Hub's own tracker, named after the Book of Mudora
  (the one that reads the old writing; this one reads your game).
  - **Logic: Hutch's, unchanged.** His item tracker and map still run, out of sight,
    and Mudora shows their answers: which checks are in logic, cleared checks, dungeon
    colours, items, keys and prizes. Clicks go back to his tracker, so both stay in
    step, and his updates come in through the usual Hutch updater. None of his
    pictures are shown.
  - **Everything you see comes from the game:** item icons are cut from the game's own
    pause menu by a hidden copy of the emulator (randomizer menus too), the two worlds
    are drawn from the ROM, and the dungeon maps are the Explore / Map / Full ones.
  - **Checks where they really are:** each pin sits on the door, cave, hole, item or
    person in the game (read from the ROM); a few spots that aren't one place keep
    Hutch's position.
  - Items (click up, right click / hold back; right click a medallion for MM / TR),
    a dungeons panel (prize, big key, map, compass, small keys, chests left: click to
    count, right click to undo; click a dungeon for its map), hover cards with Done /
    Not done and marking which item is at a check, counters (checks, deaths, bonks,
    Ganon's Tower chests and where its big key was), the colour key, and the phone
    tabs (Items / Light World / Dark World). "⧉ Mudora" opens it in its own window.
  - Fixed: zooming the map could crash iPhone Safari (out of memory). The worlds are now
    drawn on a canvas the size of the screen: a small copy of the whole world when
    zoomed out, only the screens in view at full detail when zoomed in. Dungeon maps
    zoom in at most 2.5×.
  - Phone: a **Keys** tab of its own (the dungeons panel), so Items no longer scrolls.
  - Pins: Blind's Hut on its own doorway (the gap in the hedge left of the house), the Race Game on its heart piece,
    and a second Purple Chest pin on the man by the sign who opens it (Light World).
  - Death Mountain's open sky is drawn in the game's dark teal instead of grass green
    (the maps from the game, both trackers), and King Zora / Zora's Ledge sit where the
    river leads north into Zora's area.

## Beta: EmoTracker (2026-10-19)

- **Tracker → EmoTracker (beta):** the official EmoTracker ALTTPR pack, running in the
  browser with autotracking from the game: items, map with logic colors, location
  popups (click a chest when collected), pinned locations, and the pack's own views
  (items beside or below the map, broadcast, items only). Its trackers follow the
  Tracker world / dungeon items settings (standard, keysanity, inverted, inverted
  keysanity), or pick one in its own menu. Marks are kept per game.
- Desktop layout: "⧉ EmoTracker" opens it in its own window.
- The beta keeps its own saves and tracker choice, apart from the main app.
- EmoTracker additions:
  - **Bombs logic for today's randomizer:** the pack (2019) assumed bombs are always on
    hand. Now the spots behind bombable walls need bombs (Chicken House, Brewery,
    Aginah's Cave, Kakariko Well and Blind's Hut top chests, Hype Cave, Mini Moldorm
    Cave, Ice Rod Cave), or bombs or boots (Sahasrahla's back room, Race Game), as in
    Hutch's tracker. Running out of bombs turns them red again.
  - **Point at a square** to see its checks (tap on touch screens); the card stays while
    you use it. Click a chest to mark it.
  - **Mark which item is at a location:** right click a square, or hold it on a phone or
    tablet (also the + on each check in the card). The item shows on the square.
  - **Map key** (what each color means), and **counters** from the game: checks,
    deaths, bonks.
  - **Dungeons panel** under the items: chests left per dungeon (click to count down),
    small keys and big keys.
  - **Ganon's Tower**: chests opened (of 26) and which chest had the big key.
  - **Dungeon maps (Explore / fog of war):** World and a button per dungeon above the
    maps. Each dungeon room is captured from the game's picture as you walk through it
    and laid out where the game keeps it, so the dungeon fills in as you explore; Link
    shows as a dot. Entering a dungeon switches to its map, leaving switches back.
    Zoom with the wheel or a pinch, drag to move, double-click/double-tap to fit. Kept
    per game in the browser.
  - **Map pins where they really are:** 69 of the pack's map pins moved onto the spot in
    the game itself (the door, cave mouth, hole, or the item/person on the screen), read
    from the ROM. They were placed by eye on a small map and showed slightly off on the
    sharp map drawn from the game. Spots that aren't one place (Lost Woods, the race,
    digging spots, Spectacle Rock's cave + top, Zora, the bridge, …) stay where they were.
  - **Test: warp to a dungeon** (emulator menu ⋯ → Game): pick a dungeon from the list
    and Warp drops Link in at its entrance. The game is saved in memory first, so
    "Back to before the warp" undoes it.
  - **Dungeon maps, three kinds** (Dungeons menu in the tracker's bar):
    - *Explore (fog of war)*: as above, now by floor (B1, 1F, 2F…) and cropped to what
      you've seen.
    - *Map (like the game)*: each floor as a grid of rooms, like the pause map. Rooms
      you've been in are filled in; with the dungeon's map the rest show as outlines;
      with its compass the boss room gets a skull. Works on phones.
    - *Full (every room)*, desktop only, with a warning first: every room of the
      dungeon drawn whole up front, for players new to rando (finding the way to each
      check, and pots in pot shuffle). A hidden copy of the emulator builds the rooms
      with the game's own code the first time you open each dungeon (a few seconds),
      and the pictures are kept per game. Your own game isn't touched.
  - **Phone map fixes:** the maps drawn from the game are now 64 screen-sized pictures
    per world instead of one huge one (iPhone Safari wouldn't draw the big one, so the
    map showed black), and touch zoom forgets fingers lifted off the map (a leftover
    one made the next touch zoom all the way in). Double-tap resets the zoom.
  - **Phone layout:** EmoTracker uses the same Items / Light World / Dark World tabs as
    Hutch's tracker on phones: one panel at a time, fitted below the game with no page
    scrolling (upright or sideways). − / + zoom the map; the tracker's own menu folds
    behind its ⚙.
  - **Location cards:** fixed cards that wouldn't close while autotracking was running
    (they were rebuilt on every update, which swallowed clicks); buttons now act the
    moment you press them, and Esc closes. New **↺ Reopen** button marks everything at a
    location not collected again (right click a single chest to reopen just that one).
  - **Maps drawn from the game:** both worlds are drawn pixel for pixel from the ROM
    being played (the full 4096 x 4096 overworld), so they're sharp, and a seed that
    changes the overworld shows its own map. Saved in the browser after the first time.
    "Game maps" turns it off (the pack's pictures).
  - **Zoom:** mouse wheel or pinch on a map, drag to move around, double-click to see the
    whole world. The squares keep their size.
  - **Grid:** the game's screens drawn on the maps (Grid checkbox).
  - **Bigger, sharper item icons:** an Items size menu (Small / Medium / Large; Auto
    picks Medium on a wide window), always at whole-pixel scales.
  - Item placement (the tracker's logic setting) starts on **Advanced**, the
    randomizer's default, and follows the Randomizer bar's Item placement.
- Also in this beta: Crowd Control+ 1.8.0 (checks and bosses on the subathon clock)
  and 1.9.0 (GT big key guessing game).

## 1.9.0 (2026-10-19)

Crowd Control+:
- **GT big key guessing game** (Live games tab): chat guesses which Ganon's Tower chest
  has the big key (`!gt 1`–`!gt 26`, one guess each). The game counts the GT chests
  opened (26 chests, not Bob's Torch; the same flags Hutch's tracker reads) and reports
  the count when the big key arrives, so exact guesses win, or the closest. Guesses
  close at the first GT chest (or by hand); the number can be set by hand if the game
  couldn't count it. New "GT big key" overlay (guesses per chest, chests opened,
  winners) and an optional "BIG KEY FOUND!" alert. Test button.

## 1.8.0 (2026-10-19)

Crowd Control+:
- **Checks and bosses on the subathon clock** (Subathon tab → Progress on the clock):
  each new check and each boss beaten takes time off the clock (or adds time), e.g.
  1 minute per check and 5 minutes per boss. Counts from when Crowd Control+ first
  sees the game, so a game picked up halfway doesn't take hours off at once; a new
  seed starts over; boss detours don't count. The clock overlay shows each change
  (red for time off, with the reason) and bosses can pop a "BOSS DEFEATED!" alert.
  Test buttons for both.
- The game now reports which bosses are beaten (the 10 dungeon bosses, Agahnim,
  Agahnim 2) along with the other run stats.
- Fix: boss detours used the wrong bit for "boss beaten" (now the room flag's 0x08,
  the same bit the trackers read). "Random boss" now really skips beaten bosses,
  and a detour to a beaten boss brings him back for the fight.

## 1.7.1 (2026-10-19)

- **License:** Rando Hub and Crowd Control+ are now under the PolyForm Strict License
  1.0.0 (`LICENSE.md`), with added permission to use them on streams and videos,
  monetized ones included (`NOTICE.md`). Anything beyond that (copying code, changes,
  re-hosting, commercial use) needs permission: open a "Permission request" issue.
  Other people's parts keep their own licenses. Both zips now include the license.

## 1.7.0 (2026-10-18)

Stream layouts for the tracker (Desktop layout), two ways:
- **Stream windows:** one click opens two windows set up for capture: items + dungeons
  in one, the Light and Dark World side by side in the other. Black background,
  fitted to the window, menu bars hidden (all changeable in each window's options).
  Click again to put them back.
- **Stream:** one window with everything (items and dungeons on top, both worlds
  below) for a single OBS capture. Maps below or beside the items, a divider you can
  drag, one background for both.

## 1.6.0 (2026-10-18)

New crowd control, from playtester requests:
- **Random enemy** (`enemy_random`): spawns a random enemy a few steps from Link, chosen
  from the ones whose graphics are already loaded in that area (each area loads four
  sprite sheets; enemies from other sheets would show as garbled tiles). Sheet needs come
  from Enemizer (MIT). Indoors it picks open floor. If nothing fits, it copies a nearby
  enemy like Extra enemy.
- **Warps:** `warp_dungeon` drops Link into a random dungeon entrance (the dungeon he
  leaves keeps its small keys); `warp_flute` opens the game's flute menu and the bird
  takes him to a random flute spot (Light World outdoors; elsewhere it falls back to a
  dungeon); `warp_random` does either. The gift card says where he went.
- **Several like triggers:** e.g. +1 heart every 300 likes, small magic every 500, full
  heal every 2000, each counting on its own. Edit them on Gifts & effects (old single
  `likes` settings still work). New `magic_small` effect (¼ meter).
- **Boss detour random boss** only picks bosses not beaten yet in the run (Ganon always
  can be picked), so no empty arenas.

## 1.5.0 (2026-10-18)

**Crowd Control+**
- **Local signer (recommended): no TikFinity needed.** Dashboard → TikTok connection: type
  your TikTok name and click Connect. Crowd Control+ opens your own LIVE page in its own
  Chrome / Edge window (separate profile, so the TikTok login is remembered; muted) and
  reads the gifts, likes, follows, shares and chat TikTok sends that page, over Chrome's
  debugging connection. Free, no other apps, no keys, no npm packages
  (`crowd-plus/localsigner.mjs`: a small WebSocket client and protobuf reader of our own).
- **TikFinity is the one-click backup** if a TikTok update breaks the local signer:
  Dashboard → TikTok connection → "TikFinity (backup)". Switching needs no restart.
- New installs default to the local signer; existing `mapping.json` files that say
  `"source": "tikfinity"` keep TikFinity until switched on the Dashboard.
- The advanced "direct" source now defaults to Euler Stream's free Community plan.
- Instructions, README and release notes: local signer first, TikFinity as the fallback.
- The local signer's browser profile (`crowd-plus/tiktok-window/`, holds the TikTok login)
  is never put in release zips or the repository.

## 1.4.0 (2026-10-18)

- **Crowd Control+ is the only crowd control.** The Rando Hub zip no longer has a "Crowd
  Control" folder; crowd control is the second download, `Crowd-Control-Plus-vX.zip`.
  The old panel-less bridge is archived in `archive/crowd-control-standard` (and in
  every release up to 1.3.7). Its `mapping.json` works as-is in Crowd Control+.
  README, INSTRUCTIONS and release notes updated to match.
- **Test buttons in both places:**
  - Control panel → Gifts & effects → **Test any effect**: one button per effect the game
    has, plus the mystery box and the boss-detour rescue.
  - Game → ⋯ menu → Crowd effects: **Test one boss** (any of the 13), and while connected
    to Crowd Control+, **Fake gift** (alert + effect) and **Mystery box**.
- Boss tests pressed during a detour now wait their turn instead of being dropped.

## 1.3.7 (2026-10-18)

- Boss detour to Ganon: fixed getting stuck in a black room until "couldn't reach the boss".
  Ganon is now reached like the other bosses (dungeon lobby, then straight to his room)
  instead of the Pyramid hole drop.

## 1.3.6 (2026-10-18)

- The game's … menu → Crowd effects now lists the last few things that happened to crowd
  effects (test pressed, queued, running, boss detour start / warp / end, any error), to
  track down effects that don't fire.

## 1.3.5 (2026-10-18)

- If crowd effects (or a test) are waiting more than a few seconds, the game says why on
  screen: a boss detour still running, or Link not in normal play (with the details).

## 1.3.4 (2026-10-18)

**Crowd Control+**
- Fixed test buttons and the subathon timer doing nothing for minutes, then everything
  firing at once. The Overlays tab's previews each held a connection open, and browsers
  allow only about 6 to one address, so the buttons had to wait. The previews now share
  the control panel's connection (buttons answer instantly with every preview open).
- Starting Crowd Control+ no longer opens a second control panel tab when one is already
  open, and the panel shows a red bar if it's open in more than one tab.

## 1.3.3 (2026-10-18)

- Crowd Control+ keeps running if something goes wrong while handling a game message
  (it logs the error in the black window instead of closing).
- The game's Crowd effects menu shows how many effects are waiting and, during a boss
  detour, which boss and what stage it's at. A boss test that can't start now says why.

## 1.3.2 (2026-10-18)

- Boss detour:
  - The BOSS DETOUR banner now sits at the very top of the game, over the HUD, instead
    of over the room. It's the only announcement: no extra gift card for detours.
  - Fixed getting stuck in a dungeon lobby (seen at Swamp Palace), which also blocked
    the test buttons until the app was restarted. The detour no longer waits for Link
    to be "unfrozen", drops in through another lobby if the first doesn't work, and
    every detour now ends on its own at the latest 45 s after its timer, whatever happens.

## 1.3.1 (2026-10-18)

- Boss detour: fixed only a narrow strip of the room showing (seen at Agahnim 2). The
  screen mask from the entrance's spotlight effect is now turned off when Link arrives.

## 1.3.0 (2026-10-18)

- **Gift alerts on the game:** each gift, follow or share that sets off an effect shows a
  card over the hearts (top right of the HUD) for 3 seconds: who sent it, the gift, and
  what it does. Like the MSU "NOW PLAYING" card, it's part of the game picture, so it's
  on stream without adding an overlay. On by default; ... menu → Crowd effects → "Gift
  alerts over the hearts". Several at once take turns.

## 1.2.6 (2026-10-18)

- Fixed rupee crowd effects (+50 / -50, and the boss detour's "survived" reward) cutting a
  wallet over 999 down to 999. Randomizer wallets go to 9999.

## 1.2.5 (2026-10-18)

- **Boss detour:**
  - The boss is always there: a boss already beaten in your run is brought back for the
    detour, and Blind's fight starts without bringing the maiden. Before, Thieves' Town
    could be an empty room.
  - Link lands in the part of the room where the boss actually is (found from the boss
    itself, so it also works with boss shuffle), on open floor away from the boss.
- **Crowd Control+:** "Test one boss" on the Live games tab sends Link to any boss you
  pick, for checking each fight. Gifts set to the random boss still pick at random.

## 1.2.4 (2026-10-18)

- **Boss detour:** Link now lands on open floor inside the boss arena with the camera
  on him. Before, he kept his spot from the dungeon's entrance room, so he could end up
  inside a wall (Ice Palace) or in the wrong part of the room (Thieves' Town). Entry
  spots come from the boss doors (thanks to the lttphack practice ROM's presets);
  rooms without one use the part of the room with the most floor. Falling into a pit
  during a detour also puts him back there.

## 1.2.3 (2026-10-18)

- Fixed the **drunk wobble** crowd effect: it showed as applied but the picture didn't move
  unless another screen effect (mirror, upside down, tiny) was on at the same time.

## 1.2.2 (2026-10-18)

**Crowd Control+**
- Overlays: new `?screen=green` (or `?screen=magenta`) option, a solid colour behind the
  overlay for apps that can't show a see-through page (add a Chroma Key filter). The
  Overlays tab and INSTRUCTIONS.txt explain the "white box" fix.
- EFFECTS-OVERVIEW.md now lists every effect (screen flip, wobble, boss detours …);
  release zips always copy in the current list.

## 1.2.1 (2026-10-18)

- Crowd Control+ now opens the control panel in your browser by itself when it starts,
  as the instructions say (it only printed the address before).

## 1.2.0 (2026-10-17)

**Rando Hub**
- Boss detour crowd effects: `boss_ganon`, `boss_aga`, `boss_random`. The game takes a
  save state, drops Link into the fight, and loads the save when the fight ends (time's
  up, Link falls, or he wins), so the run continues untouched. Length is
  `durations.boss_detour` (60 s). ⚙ menu → "End boss detour now" ends one early.

**Crowd Control+**
- Boss detour card on the Live games tab: rewards for winning or surviving (effect and
  subathon seconds), test buttons, and a "Rescue Link" gift effect (`detour_rescue`).
- Gold BOSS DETOUR alerts at the start and end of each detour.

## 1.1.1 (2026-10-17)

- The "NOW PLAYING" MSU card now sits at the top of the game, over the rupee, bomb
  and arrow counters, so it never covers Link or the room.

## 1.1.0 (2026-10-17)

**Rando Hub**
- "NOW PLAYING" card on the game for 3 seconds whenever the MSU-1 pack changes
  (♪ menu, 🎲 roll or a crowd gift), with or without crowd control.
- New crowd effects: mirror mode, upside down, drunk wobble, tiny screen, retro CRT,
  speed up (1.5x), slow motion, freeze, fairy or bee in a bottle, pink Link and music
  roulette (a random song from the MSU-1 pack).
- With crowd effects on, the game sends run stats (deaths, checks, where Link is,
  music, seed) to the bridge.

**Crowd Control+**
- Live games: chat votes, team battle (Light vs Dark World), mystery box slot
  machine, combo meter and predictions, each with an overlay and panel controls.
- Run & stream: run stats overlay, death tax, clip markers (automatic, Mark now and
  viewers' `!clip`), hall of fame (all-time gifters) and welcome-back pop-ups.

## 1.0.2 (2026-10-17)

- New second download: **Crowd Control+** (`Crowd-Control-Plus-v1.0.2.zip`), the
  crowd control bridge with a control panel (gift setup with menus, test buttons,
  live event log, profiles) and stream overlays in the Rando Hub style: gift alerts
  with sounds, goal bars, top gifters, recent events and chat command replies, plus
  reading chat aloud. Source in `crowd-plus/`.

## 1.0.1 (2026-10-17)

- New Rando Hub logo: a red-and-white randomizer die with "RANDO HUB" in pixel
  lettering, as the app icon and in the header.
- Header name now uses the Press Start 2P pixel font (bundled, works offline).

## 1.0.0 (2026-10-17)

First public release of **Rando Hub** (previously tested as ALTTPR Snes9x Beta).

- A Link to the Past Randomizer on a built-in Snes9x emulator (WebAssembly),
  with graphics filters (6xBRZ, 4xBRZ, CRT, sharp pixels and more), save states,
  button remapping and an on-screen controller that sits over the game.
- Hutch's item tracker and map autotracking from live game memory, with Phone,
  Tablet, Stacked, Desktop (pop-out windows) and Classic layouts.
- Three seed generators: alttpr.com, Kara's branch (door / entrance /
  overworld shuffles) and AVIANART, plus the Customizer, saved presets,
  Reroll, seed links and race seeds.
- Link sprites from the alttpr.com library, MSU-1 music packs, Resume last
  game, and offline play.
- TikTok LIVE crowd control: gift effects, seed rolls by coins, a subathon
  clock and a scrolling gift list for OBS / TikTok LIVE Studio.
- Installs as an app on phones, tablets and computers (PWA).
- Downloadable zip with INSTRUCTIONS.txt, launchers to play from your own
  computer, the crowd control bridge, and the relay sources.
