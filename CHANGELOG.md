# Changelog

Every version is also kept as a download on the
[Releases page](https://github.com/hugecrankhank/Rando-hub/releases): a zip
with the whole app, crowd control and instructions, so any version can be
played again later.

## Beta v1.14.0 (2026-10-27)

- **Three more Final Fantasy randomizers** (`ffr/`): **FF1 Randomizer**, **FF4 Free
  Enterprise** and **FF5 Career Day**, in the Game row (**FF1 ▸ FF4 ▸ FF5 ▸**), the header
  (**FF1·4·5 ▾**) and every other game's header (**FF ▾**).
  - Seeds are rolled on each randomizer's own site (a **Roll a seed** button explains the
    three steps; FF1R and Free Enterprise generate in your browser there), then **Play
    ROM file** here: the hub's NES for FF1, Snes9x for FF4 and FF5. The ROM is kept in
    this browser so **Continue** brings it back; saves, states (F5 / F8), autosave.
  - **Trackers read the running game:** FF1's 17 key items, orbs, ship/airship/bridge/
    canal, gold and shards; FE's 18 key items (found, and struck through once used),
    characters found, 35 bosses, chests, the key-item check count, and the seed's
    objectives with live progress and flags, read from the ROM; Career Day's 20 key
    items, 22 jobs, the key-item bosses and the event rewards, by area. Anything the
    game can't tell you, tick by hand.
  - Same screen rule as FF6: the picture at exactly its size, the tracker gets the rest,
    on desktop, iPad, tablets and phones.
  - *Caveat:* built from the randomizers' own source and tracker tools, tested against
    simulated memory (no real seeds here). FF4's "characters found" and FF5's key
    items are the two readings I'd check first on a real seed.
  - Not yet: in-page generators (FF1R's is .NET; Free Enterprise's API needs a key
    from its author; Career Day's runs on its server) and crowd control.

## Beta v1.13.0 (2026-10-26)

- **New game: Final Fantasy VI: Worlds Collide** (`ff6wc/`, **FF6 ▸** in the Game row and
  the header). Roll a seed from your own Final Fantasy III (USA) v1.0 ROM, play it on the
  hub's Snes9x, and the tracker follows along.
  - **The generator is Worlds Collide itself** (MIT), run in your browser with Pyodide,
    the way Z1R runs ZORA: the same seed and flags give the same game as a computer
    would. Downloaded the first time you roll, then cached. Nothing is uploaded.
  - **Presets:** the Ultros League flags (character gating), the same with an open
    world, or any flag string pasted from ff6worldscollide.com. Download the ROM and
    the spoiler log, or play straight away.
  - **Tracker, read from the game's memory:** characters, espers, the 62 checks by
    area, dragons, bosses, Kefka's Tower open or not, the game's own counters, plus
    the seed's objectives and hash. Tick by hand what the game can't tell.
  - **Layout:** the picture gets exactly its size and the tracker the rest, on every
    screen: sideways (desktop, iPad and tablets held sideways) the picture is as tall
    as the page with the tracker on the right; upright (phones and tablets) it is as
    wide as the page with the tracker under it; narrow trackers show one tab at a time.
  - Saves, states (F5 / F8), Continue after the app was closed, Reroll (same flags),
    seed history, installable app. Picked by hand only: rerolls and Crowd Control
    never switch to it.
  - *Caveat:* built and tested against Worlds Collide's code with a stand-in ROM (no
    FF6 ROM here), so the first real seeds are the real test. The generator runs
    unchanged, so a seed's contents are Worlds Collide's; the page's job is the plumbing.
  - Not yet: FF6 crowd control effects and an FF6 item/shop reference. Say the word.

## Beta v1.12.5 (2026-10-26)

- **Zelda 1 crowd control: 17 new effects** (mapped like the others in Crowd Control+; the
  bridge gets the new list when Zelda 1 connects):
  - **Whirlwind: random level / Level 1 / Level 8:** the recorder's whirlwind, summoned by chat.
    It sweeps in along Link's row, carries him off and drops him at that level's entrance, using
    the game's own tables, so shuffled entrances land right. Overworld only; one at a time.
  - **Sword gone / Sword downgrade (30 s), Sword upgrade:** the sword held at nothing or one
    grade lower for a while, or stepped up for good (Wooden → White → Magical).
  - **Ring gone / Ring downgrade (30 s), Ring upgrade:** the same for the Blue and Red Rings.
    Link's colour changes right away, as when a ring is picked up.
  - **Item gone (random)** and **Candle / Bow / Boomerang / Magical Rod / Ladder / Raft gone**
    (30 s): the item is taken for a while and comes back by itself. An item Link finds again
    (or upgrades) during the loan is his to keep. Each says why when Link doesn't have the item.

## Beta v1.12.4 (2026-10-26)

- **Lighter on the PC, less input lag** (the SNES emulator):
  - **Filter → Auto** (the new default): starts at 6xBRZ and, if frames keep running long,
    steps down to 4xBRZ, then Sharp, and says so. Software rendering (no usable graphics
    driver) goes straight to Sharp. The level it settles on is remembered. Picking a filter by
    hand still works as before.
  - **Run-ahead** (⋯ → Graphics, off by default): shows each frame one frame early, like
    RetroArch's run-ahead, so a press shows up about 16 ms sooner. It runs the game twice per
    frame (about double the CPU): for computers, not phones.
  - **Sound 20 ms sooner on computers:** the sound queue is 40 ms there instead of 60 (phones
    and tablets keep 60, which they need), and each frame's sound is handed to the output
    without an extra copy.
  - **Windows app:** the GPU is used for the picture even where Chromium's driver blocklist
    would fall back to software rendering, and the page is rasterized on it too.

## Beta v1.12.3 (2026-10-26)

- **Live games without Crowd Control** (HydeOut): the **GT big key game** (which Ganon's
  Tower chest has the big key, 1-22) and the **Digging Game** (which dig gives the prize,
  1-30), run right in Rando Hub. **🗝** and **⛏** at the right end of Mudora's map bar (by the
  maps, in every layout), and **🗝 Key game** / **⛏ Dig game** in the Desktop layout's window
  bar. Start a round, type in the guesses (a name and a number; one guess per name), and play:
  guesses close at the first GT chest / first dig, the game counts the chests and digs, and when
  the big key or the prize turns up the result shows over the game: exact guesses win, otherwise
  the closest. If the game can't tell (the big key came from outside GT), enter the number by
  hand. Rounds are kept per seed through a reload.

## Beta v1.12.2 (2026-10-26)

- **Auto layout:** iPads get the iPad layout; every other touch tablet (Android) gets the Tablet
  layout, sideways and upright, with either tracker. Upright with Hutch's tracker, Auto now uses
  the upright arrangement like Tablet picked by hand (it squeezed the game between the maps).

## Beta v1.12.1 (2026-10-26)

- **Tablet layout fits wide tablets** (16:10, like the Galaxy Tab S9 FE), using the whole screen:
  - **Mudora / Mudora 2.0, sideways:** a new arrangement. The game top left at exactly its
    picture's shape (no black bars), the counters (Checks, Deaths, Bonks, GT chests, dig game) in
    the strip under it, the items and dungeons in a column beside it, and Light World over Dark
    World filling the right side full height. Before, Tablet with Mudora fell back to the
    classic layout (two-row header, Mudora's options taking room, cramped maps). Auto picks it on
    Android tablets too.
  - **Upright (and on iPads):** the game box is cut to the picture's width, with the counters
    in the space beside it instead of black bars; the items get the full width again.
  - **Hutch's tracker, sideways:** the gap between the maps is sized for the screen (the game
    fills it at the maps' height, 24% bigger on a Tab S9 FE) until you set it with −/+; the
    bands no longer scale into two rows of dungeons on wide screens. **Upright**, Tablet now uses
    the upright arrangement (game on top) instead of squeezing the game between the maps.
  - The compact header fits on one row on an upright tablet.

## Beta v1.12.0 (2026-10-26)

- **Patched games** (new page, `patched/`; **Patched ▸** next to Zelda 1 and GLR): play NES and
  SNES ROM hacks on Rando Hub's own emulators. Pick your original ROM and the hack's patch
  (**.ips**, **.bps**, **.ups**, or the **.zip** it came in): it's patched right in the browser
  and kept in a library, nothing uploaded and no games or patches shipped with the app.
  BPS / UPS patches check the ROM is the right one and say which one they want if not; SNES
  copier headers are added or taken off to match. Each game's **title screen becomes its
  cover** (picked by itself the first time you play), shown in the library and beside the
  game where the trackers usually are; **📸 Use this screen as cover** or **🖼 Choose a picture**
  to change it. Original ROMs can be remembered for the next hack. In-game saves and save
  states (F5 / F8) work as everywhere else.

## Beta v1.11.4 (2026-10-26)

- **Zelda Classic button removed** (from 1.11.3): ZQuest Classic is better used as its own
  program. Everything else is unchanged.

## Beta v1.11.3 (2026-10-26)

- **Zelda Classic ↗** next to the other games (the header and the Randomizer bar's Game row,
  on the hub, Zelda 1 and GLR): opens **ZQuest Classic**, Zelda Classic's engine (renamed and
  still developed since zeldaclassic.com closed), in its official web player with the original
  Zelda and its whole quest database. It runs in its own window: a pop-up in a browser, a
  window of its own in the Windows app, which stays open if you close Rando Hub. Its saves are
  its own.

## Beta v1.11.2 (2026-10-26)

- **Z1R Training** (Zelda 1, beta): **🎯 Training** in Zelda 1's header. Record a speedrun
  route by playing it once (for example along with a run video), then **Guide** draws it
  over the game: an arrow at the edge to leave by, GO IN / EXIT / STAIRS / WARP where the
  route goes into a cave or level, the bush, wall, rock, grave or armos outlined with what
  to do (BURN, BOMB, PUSH, TOUCH), where to drop bombs, a dotted trail of the line to walk,
  and your own notes per screen. It follows you as you play and says where the route
  continues if you leave it. Routes export to a file to share, and import on any computer.
  Works with the normal game and with seeds. See `z1r/README.md` → Z1R Training.

## Beta v1.11.1 (2026-10-26)

- **Counters under the dungeons on computers.** Mudora 2.0 and Mudora now show the counters
  (Checks out of the places there are, Deaths, Bonks, and Ganon's Tower chests with where the
  big key was, plus the digging game when it's on) in a **Counters** section below the dungeon
  list, in the Desktop, Tablet and Classic layouts and the Windows app. Until now they only
  showed beside the items in the iPad layout.

## Beta v1.11.0 (2026-10-26)

- **Windows app.** Rando Hub now comes as a Windows program too:
  **`Rando-Hub-Beta-Windows-v1.11.0.zip`** on the [Releases page](https://github.com/hugecrankhank/Rando-hub-Beta/releases/latest). Unzip it anywhere and double-click
  **`Rando Hub Beta.exe`**. Nothing to install: no browser, no Node.js. It's the same app as the
  website, in its own window with its own icon, and it plays offline (Kara's generator and
  its Python are built in).
  - Pop-out trackers, Stream windows, Timer and Broadcast open as real windows you can
    capture in OBS; the game keeps full speed when another window is in front.
  - **Updates:** it checks when it starts and every few hours. A new version gets a
    one-time alert and a green **Update vX.Y.Z** button at the top right of the header
    (otherwise the button reads **Check for updates**). **Download update** saves the new
    zip to Downloads; unzip it over the old folder and your saves stay.
  - **Menu → Version** switches between the built-in copy and the live website.
  - Saves stay in `%APPDATA%\Rando Hub Beta`; a `data` folder next to the .exe makes it portable.
  - Seed links shared from the app point at the website, so anyone can open them.
  - Windows may say "Windows protected your PC" the first time (the app isn't
    code-signed): **More info → Run anyway**.
  - Built from each release by the Release workflow (`desktop/`, see `desktop/README.md`),
    so every new version gets its Windows zip automatically.

## Beta v1.10.18 (2026-10-25)

- **Zelda 1's overworld map works like Mudora's:** drawn from the ROM at full detail (sharp
  pixels when zoomed in), zoom with the wheel or a pinch, drag to move, double-tap or ⟲ for the
  whole map. Every check is a pin on its own square, read from the ROM: the cave mouth, bombable
  wall, burnable bush, pushed rock or armos that opens it, the secret armos stairs and the armos
  item, and the Level 7 lake's stairs. Link is a blinking dot where he stands, and zoomed in the
  view follows him to a new screen. On phones the map takes the panel's height. Tap a pin (or a
  screen) for the same menu as before.

## Beta v1.10.17 (2026-10-25)

- **No "Light World" / "Dark World" names over Mudora's maps** any more, on any device.
- **Black and white Home Screen icon on iPhone** (the die, white on black, to sit with a
  monochrome Home Screen). iPad, Android and computers keep the colour icon, and the app itself
  keeps its colours. ⚙ Settings → **Home Screen icon**: Auto, Colour or Black & white. iOS reads
  the icon when you Add to Home Screen, so an icon already there changes once it's removed and
  added again.

## Beta v1.10.16 (2026-10-25)

- **Zelda 1 and The Guardian Legend live in Rando Hub now.** `z1r/` and `glr/` are the apps
  themselves (complete, each with its README); the separate repositories they started in were
  for beta testing and are archived. Deploys no longer copy them in (`tools/update-z1r.py`,
  `tools/update-glr.py` and the `z1r-hub/` / `glr-hub/` folders are gone; `hub.js` in each
  app is where the hub glue lives).
- **"◂ Zelda 3" is now just "Zelda 3"** in Zelda 1 and GLR: with three games, the buttons are
  plain names.

## Beta v1.10.15 (2026-10-25)

- **Mudora / Mudora 2.0 maps on phones and iPads: press and hold works as a right click again.**
  Holding a check opened its card but, on letting go, also marked it (or unmarked it) as if
  it had been tapped. The hold now only opens the card; a tap still marks.
- **Zelda 1 and GLR say their seed generators are beta** (not fully vetted yet), on their
  start screen and in New seed. Zelda 1's start screen says "Zelda 1 Randomizer".
- README brought up to date with everything since 1.9.0.

## Beta v1.10.14 (2026-10-25)

- **The Guardian Legend (GLR) is in Rando Hub** at glr/, a copy of the GLR app kept up to date
  with it on every deploy. Pick it from the Randomizer bar's Game row ("Guardian Legend ▸") or
  the GLR ▸ button by Zelda 1 ▸; GLR has ◂ Zelda 3 and Zelda 1 buttons to come back, and Zelda 1
  has a GLR button. It's only ever picked by hand: 🎲 Reroll, "Rerolls can land on either game"
  and Crowd Control's preset / CHAOS seeds stay on Zelda 3 and Zelda 1. GLR seeds go into
  Seed history.

## Beta v1.10.13 (2026-10-25)

- **Installed apps no longer get mixed up.** Rando Hub, Zelda 1 and GLR all live on the same
  site (hugecrankhank.github.io) and all named themselves the same app, so installing or
  opening one could turn another's desktop / home screen app into it (an installed Rando Hub
  opening GLR). Each one is now its own app. An install that already got switched has to be
  removed and installed again.
- **Zelda 1 no longer clears other apps' offline copies** when it updates (it cleared every
  saved copy on the site, Rando Hub's offline download included); it only clears its own.

## Beta v1.10.12 (2026-10-25)

- **iPad layout with Mudora and Mudora 2.0** looks like it does with Hutch's tracker: the game
  on top, items and dungeons under it, and the maps below (upright) or in a column beside it
  (sideways). Mudora fills the area and the game sits over the space it leaves; Mudora's options
  are behind its ⚙. (`mudora-stack.js`)
  Under the game, as in Hutch's: the items in two long rows across, and the 13 dungeons as a
  row of small cards (name, prize, big key / map / compass, keys, chests left), so the game gets
  most of the height.
  The items sit at the left, and right of them the counters: checks out of the places there are
  (45/216), deaths, bonks, the GT big key game (chests opened, which had the big key) and the
  digging game (digs, which dig gave the prize).
  The counters stay up while the game's map or a menu is open, are a little smaller and shrink
  to fit an upright iPad, and never make the items smaller (they're back to full size).
- **"Stacked" is now called "iPad"** and is the starting layout on an iPad. Every other tablet
  starts on **Tablet**. Picking a layout by hand still wins.
- **Prizes on the game's map:** whatever crystal or pendant the game itself draws on its world map
  is copied to the tracker on its own (HydeOut: a click per step had marked three crystals as
  green pendants). The game's prize pictures are read from its sprite list: crystal ($64) or
  pendant ($60/$62), its colour from the palette (red, blue, green). Red X's and crystal numbers
  are small sprites and never count; a change made by hand afterwards stays. Tapping a dungeon's
  button now opens a picker (green pendant, pendant, crystal, red crystal, ?) instead of stepping.
- **Trackers:** Hutch, Hutch Beta, Mudora 2.0 (Muffins logic), Mudora (Hutch logic), Off.
  EmoTracker and Muffins' own tracker are no longer offered: Mudora 2.0 already runs Muffins'
  logic with Mudora's items and maps. Anyone on either is moved to Mudora 2.0. (His tracker is
  still there inside Mudora 2.0, for his launch page, settings and entrance menu.)

## Beta v1.10.11 (2026-10-25)

Mudora and Mudora 2.0, from HydeOut's notes:

- **Crystals and pendants look right and stand out.** Their pictures no longer bring bits of the
  crystals next to them in the game's menu, the crystals' dark facets aren't see-through holes,
  and they're cropped to fill a bigger box. Not yet got: grey. Got: bright, with a glow in their
  own colour. (The pictures are drawn again from the game once, on the next start.)
- **This dungeon:** a card under the dungeon list for the dungeon Link is in: its boss (click /
  right click to pick another, for boss shuffle; ticked when beaten), its prize (click / right
  click: which it is), small keys and big key, and a chest for every check, open once found.
  Blank outside dungeons. **List → This dungeon only** shows just the card, compact for stream;
  **Ready first** puts the dungeons you can clear on top, crystals first.
- **Follow into dungeons** (off unless ticked): the tracker no longer switches to a dungeon's
  map when Link goes in, so the world map stays up to plan the way on.
- **The maps show each dungeon's prize** once marked, inside its circle (bright once you have it).
- **Mark prizes on the game's own map.** While the world map is open in the game (X), a button
  sits by each dungeon: click for the next prize, right click for the one before (hold on a
  phone), and the tracker changes with it. Placed with the game's own sum for its map markers,
  both zoom levels. ⚙ Settings → "Prize marks on the game's map" turns it off. Mudora and
  Mudora 2.0 only.
- **The dungeon card no longer makes the side panel scroll** (HydeOut): in the panel it only shows
  with List → This dungeon only. **⧉ Dungeon card** puts it in a small window of its own, kept up
  to date, for OBS window capture.
- **Quick clicks on the tracker no longer select the pictures** (the blue highlight).
- **Icons: Game pixels / Smooth / Custom pictures.** Smooth enlarges each picture with Scale2x
  twice (stairs on diagonals and curves become smooth lines, the game's colours) and draws it
  smoothly. Custom pictures: PNG files named after the item (hookshot.png, crystal_red.png…)
  replace the game's, item by item; "Use the game's again" forgets them.
- **Bigger prizes on the maps:** the crystal or pendant now sits beside each dungeon's circle, larger.
- **Every one of Muffins' presets in Mudora 2.0** (⚙ Settings → New game from a preset): all 67
  of his, not just the 21 his launch page has buttons for. His groups come first, then
  "More presets". A **search box** above the list finds them by name, mode or description
  ("keys", "inverted", "hunt"…); Enter starts the one picked. Presets without a button on his
  page are picked from his own "Browse all presets…" list. (Mystery stays on his page: its
  settings aren't known up front.)

## Beta v1.10.10 (2026-10-25)

- **Any enemy** (`enemy_any`): one of 74 enemies appears near Link, anywhere, even in an empty
  room or a screen with no enemies of its own (an idea from JynxCast). The area's sprite
  graphics are swapped for the ones it needs: unpacked from the ROM and sent through the game's
  own graphics upload, 4 frames a sheet. Slots enemies on screen are using are left alone when
  another way works; the next screen loads its own graphics as usual.
  - Enemies and their graphics needs come from the enemizer in Kara's branch; bosses, NPCs,
    and the Mimics (they freeze the game) are left out. Water and sand ones are in, out of
    their element: a Zora's ripple on dry land, Debirandos and Swamolas anywhere.
  - From the browser console: `CrowdEffects.spawnEnemy('Lynel')`.

## Beta v1.10.9 (2026-10-25)

- **Item gone** (`item_off`, 30 s): a random item Link has is gone for the time, then comes
  back. Anything in the item menu (all four bottles count as one), the gloves, boots
  (and dashing), flippers (and swimming) or Moon Pearl. The gift alert says which one.
  - The game uses the item on Y without checking Link still has it, so Y does nothing while
    the gone item is the one equipped; the HUD keeps showing it until the menu is opened.
  - One found meanwhile is added when it comes back (bombs and gloves add up). It comes
    back after a reload too.
  - Skipped while it'd get stuck: the cape while it's on, the Cane of Byrna while its shield
    is up, the flippers while Link swims.
  - Without the pearl in the Dark World Link turns into a bunny at the next screen, and turns
    back at the next screen after it's back.
- **+1 / −1 heart container** (`heart_add` / `heart_remove`), for good: up to 20 hearts, never
  below 1. A new container fills itself, like one picked up; one taken away takes its health
  with it and leaves the HUD.
- **Tunic upgrade / Tunic downgrade** (`tunic_up` / `tunic_down`): one step along green, blue,
  red mail. Hits hurt accordingly, and Link's colors change straight away (from the ROM, so a
  custom sprite gets its own tunic colors).
- **Fixed:** Shield gone, Sword gone and Sword downgrade gave the gear back on the first frame
  (1.10.7, 1.10.8), so they did nothing. A timed effect now counts as running before it
  starts.

## Beta v1.10.8 (2026-10-25)

- **Sword effects for Crowd Control:**
  - **Sword gone** (`sword_off`, 30 s) and **Sword downgrade** (`sword_down`, 30 s, one step
    worse): the sword comes back when time's up, even after a reload. A sword found meanwhile
    is added on, since swords are progressive: found while the Tempered is down to the
    Master, it gives the Golden back.
  - **Sword upgrade** (`sword_up`): one step along Fighter's, Master, Tempered, Golden.
  - **Sword stolen** (`sword_steal`): gone until Link finds another. It can make a seed
    unbeatable, so it's marked "⚠ can end the run" in Crowd Control+, and the control panel
    asks before it's put on a gift, a level or the mystery box, or tested.
  - The new sword looks right straight away (its picture and colors come from the ROM), and
    swordless seeds skip all of them.
- **Shield gone** counts a shield found during it as one more level, as the game does.

## Beta v1.10.7 (2026-10-25)

- **Four shield effects for Crowd Control:**
  - **Shield gone** (`shield_off`, 30 s): Link loses his shield, and the same one comes back
    when time's up. A better shield found meanwhile is the one he gets back. The loan is kept
    in the browser with the seed it belongs to, so a reload mid-effect still returns it.
  - **Shield stolen** (`shield_steal`): gone until Link finds another, like a Pikit eating it.
  - **Shield downgrade** / **Shield upgrade** (`shield_down` / `shield_up`): one step along
    Fighter's, Fire, Mirror. Downgrade stops at the Fighter's Shield.
  - A changed shield looks right straight away: its picture and colors are made from the
    ROM's own graphics, the way the game does when Link picks one up.
  - Gifts that can't do anything (no shield to take, Mirror Shield already) say so in the feed
    instead of running.

## Beta v1.10.6 (2026-10-25)

- **Crowd Control's Instant death can't be blocked any more.** It used to hand Link a hit
  worth all his hearts, so the Magic Cape, the Cane of Byrna and the blink after a hit
  stopped it. It now starts the game's death right away. A bottled fairy still revives
  Link, as on any death.

## Beta v1.10.5 (2026-10-24)

- **The playtesters are in the ending of every ALTTP randomizer seed played here**, not just
  the ones the hub makes: a ROM loaded from a file, a resumed game, a seed handed over after
  a reload. The copy being played gets the names when it starts (the file itself is never
  changed); a ROM whose ending isn't laid out like a randomizer's (the plain game) is left
  alone. Seeds in progress get the names the next time they're started; Mudora counts the
  patched ROM as a new game once, so marks on a seed already in progress start fresh.

## Beta v1.10.4 (2026-10-24)

- **The playtesters are in the ending of every seed the hub starts** (HydeOut's stream
  showed the old captions): seeds from Kara's branch, AVIANART and alttpr.com bring their
  own ending, which 1.9.17 didn't touch. Now the finished ROM's ending is patched: our seven
  scenes are drawn again, the other nine (item hints, the seed's own jokes) are kept byte
  for byte, and only when it fits the space the generator used.

## Beta v1.10.3 (2026-10-24)

- **Hide gifts from the scrolling gift list** (Crowd Control+ 1.10.3): an "On ticker"
  checkbox on every gift row (the gift keeps working in the game), and "Also show"
  switches for the like, follow / share, big donation and subathon lines.

## Beta v1.10.2 (2026-10-24)

- **Mudora: Half Magic has a picture** (HydeOut): a pixel "½" in the magic meter's green,
  in the item grid and in "Mark an item…" (it was text only, so it couldn't be marked).
  The game itself only writes a 3-tile label over the magic meter, too wide to cut out.

## Beta v1.10.1 (2026-10-24)

- **Go-mode reveal marks dungeons**: an item revealed inside a dungeon now shows on that
  dungeon's square on the map (up to two pictures), next to its name in the dungeon list,
  and on its card ("Revealed inside", with Clear). Before, only overworld squares got a
  mark in Mudora 2.0.
- **Mudora (Hutch's logic) shows reveals too**: dungeons by name, overworld spots on
  Hutch's square of the same name ("Kakariko Well - Top" → Kakariko Well). A reveal that
  arrives before the tracker is ready waits for it. Hutch's own tracker, EmoTracker and
  Muffins' Tracker 2.0 on its own still only get the banner on the game.

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
