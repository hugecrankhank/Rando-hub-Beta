<p align="center">
  <img src="icons/icon-192.png" width="128" height="128" alt="Rando Hub icon">
</p>

<h1 align="center">Rando Hub Beta</h1>

> This is the **beta** of [Rando Hub](https://github.com/hugecrankhank/Rando-hub): new features are tried
> here first, then move to the main app. Your ROM and saves here are kept apart from the main app's.

<p align="center">
  <b>A Link to the Past Randomizer, a Snes9x emulator and an autotracker, all on one screen, in your browser.</b><br>
  Zelda 1 and The Guardian Legend randomizers too. Phones, tablets and computers. Installs like an app.
  Plays offline. Built for streaming.
</p>

<p align="center">
  <a href="https://hugecrankhank.github.io/Rando-hub/"><b>▶ Play now</b></a> ·
  <a href="https://github.com/hugecrankhank/Rando-hub/releases/latest"><b>⬇ Download</b></a> ·
  <a href="https://github.com/hugecrankhank/Rando-hub-Beta/releases/latest"><b>⊞ Windows app</b></a> ·
  <a href="#quick-start">Quick start</a> ·
  <a href="#crowd-control-tiktok-live">Crowd control</a> ·
  <a href="#shout-outs">Shout-outs</a>
</p>

---

## Contents

- [What it is](#what-it-is)
- [Install it on any device](#install-it-on-any-device)
- [Windows app](#windows-app)
- [Quick start](#quick-start)
- [How the app works](#how-the-app-works)
- [Crowd control (TikTok LIVE)](#crowd-control-tiktok-live)
- [Downloads and versions](#downloads-and-versions)
- [Feature guide](#feature-guide) (layouts, trackers, Mudora, other games, generators, presets, sprites, offline)
- [Running and hosting it yourself](#running-and-hosting-it-yourself)
- [Releasing a new version](#releasing-a-new-version)
- [Under the hood](#under-the-hood)
- [Shout-outs](#shout-outs) and [credits](#credits)

## What it is

Rando Hub puts everything you need for an ALttP Randomizer run in one page:

- **The game**, on **Snes9x compiled to WebAssembly**, built into the page.
  Graphics filters (6xBRZ by default, 4xBRZ, Sharp pixels, Smooth, Sharp
  bilinear, CRT), 4 save-state slots, full screen, keyboard and gamepad
  remapping, fast-forward.
- **An on-screen controller over the game** on phones and tablets, so the
  tracker keeps its half of the screen: D-pad with diagonals, ABXY (slide
  between buttons, or press the gap for two), L/R, Select/Start. Size and
  opacity are adjustable; it hides when you use a real controller and comes back
  when you touch the screen.
- **An autotracker** reading the game's live memory, four to pick from:
  **Mudora 2.0** (the default: Rando Hub's own tracker, drawn from the game itself, with
  [Muffins'](https://github.com/KrisDavie/alttptracker) logic and settings), **Mudora**
  (the same look with Hutch's logic), and
  **[Hutch's tracker](https://github.com/hutchch/ALTTPR-Tracker)** (newest release or
  his beta). Items, keys, dungeons, prizes, entrances and both world maps.
- **Three seed generators** in one menu: **alttpr.com** (the official generator,
  running in your browser), **Kara's branch** (door, entrance and overworld
  shuffles) and **AVIANART** (tournament and community presets). Plus the
  Customizer, saved presets, Reroll, seed links and race seeds.
- **Layouts for every screen:** Phone, iPad, Tablet, Desktop (tracker pieces
  pop out into their own windows) and Classic. **Layout → Auto** picks one for you.
- **More games:** the **Zelda 1** randomizer (Z1R, seeds by ZORA) and **The Guardian
  Legend** randomizer (GLR), each with its own emulator and tracker, a click away.
  Both seed generators are in beta.
- **Extras:** Link sprites from the alttpr.com library, MSU-1 music packs, item sound
  packs, Resume last game, a seed history, offline play.
- **TikTok LIVE crowd control:** viewers' gifts change your game, roll new
  seeds and add time to a subathon clock.

No ROMs are included: you use your own Japanese 1.0 ROM, and every seed is built
from it in your browser.

## Install it on any device

Rando Hub is a web app (PWA), so the website **is** the installer. Open
**https://hugecrankhank.github.io/Rando-hub/** and:

| Device | How to install |
|---|---|
| **iPhone / iPad** | Safari → **Share** → **Add to Home Screen** → Add. Always open it from that icon: iOS can clear a website's saves after a few weeks unused, but not an installed app's. |
| **Android** | Chrome → **Install app** (or menu ⋮ → *Install app* / *Add to Home screen*). |
| **Windows (app)** | Download **`Rando-Hub-Beta-Windows-v<version>.zip`** from the [Releases page](https://github.com/hugecrankhank/Rando-hub-Beta/releases/latest), unzip it, double-click **`Rando Hub Beta.exe`**. A real Windows program: no browser needed, plays offline, tells you when an update is out. See [Windows app](#windows-app). |
| **Windows / Mac / Linux / Chromebook** | Chrome or Edge → the **install icon** at the right end of the address bar → Install. |

It opens in its own window with the Rando Hub icon. Updates arrive by themselves
the next time it's opened online. For airplane mode: **Randomizer → ROM options →
Make available offline** once while online.

Prefer a file? Every version is also a **[download](https://github.com/hugecrankhank/Rando-hub/releases/latest)**
(a zip you can run on a computer; see [Downloads and versions](#downloads-and-versions)).

## Windows app

Every release also has **`Rando-Hub-Beta-Windows-v<version>.zip`**: Rando Hub Beta as a Windows program.

1. Download it from the **[Releases page](https://github.com/hugecrankhank/Rando-hub-Beta/releases/latest)** (under *Assets*) and unzip it anywhere,
   for example `C:\Games\Rando Hub Beta`.
2. Double-click **`Rando Hub Beta.exe`**. The first time, Windows may say *"Windows protected your PC"*
   (the app isn't code-signed): **More info → Run anyway**.
3. Optional: right-click the .exe → *Pin to Start*, or *Send to → Desktop (create shortcut)*.

It's the same app as the website, in its own window: nothing else to install (no browser,
no Node.js), plays offline, and pop-out trackers, Stream windows, Timer and Broadcast are real
windows for OBS. It checks for updates by itself; when there's a new version the button at
the top right turns green (**Update vX.Y.Z**) and **Download update** gets it. Unzip the new
version over the old folder: saves stay in `%APPDATA%\Rando Hub Beta`. **Menu → Version** switches
to the live website instead. How it's built: [`desktop/README.md`](desktop/README.md).

## Zelda Classic

**Zelda Classic ↗** (in the header and the Game row) opens [ZQuest Classic](https://zquestclassic.com),
Zelda Classic's engine (renamed and still developed; zeldaclassic.com closed in October 2026),
in its official web player: the original Zelda plus thousands of fan-made quests. It needs a
page of its own, so it opens in its own window (in the Windows app, a window of its own that
stays open after Rando Hub closes). ZQuest Classic is GPL-3.0, by its own developers; Rando Hub
only opens it (`zclassic.js`).

## Quick start

1. Open the app and press **Randomizer** (top left).
2. Press **Base ROM…** and pick your Japanese 1.0 *Zelda no Densetsu: Kamigami no
   Triforce* `.sfc`. It's remembered from then on.
3. Choose a generator with the arrow beside **Randomizer**, then a preset under
   **Saved presets** (or set the menus yourself).
4. Press **Generate & Play**. The tracker sets itself up to match the seed.

Already have a seed? Paste its link or number into **Load a seed**, or use
**Load ROM…** in the header for an `.sfc` you've already rolled (then set the
tracker's **World** and **Dungeon items** to match it).

## How the app works

```
Your base ROM ─► Randomizer bar (alttpr.com · Kara's branch · AVIANART) ─► seed ROM
                                                                            │
                                                                            ▼
TikTok gifts ─► crowd bridge ─► crowd/effects.js ────────────────► Snes9x (WebAssembly) ─► picture + sound
                                                                            │ live memory
                                                                            ▼
                                                        bridge/sni-bridge.js ─► Hutch's tracker (items + maps)
```

- **Making a seed.** The generator you pick builds a seed and patches it onto your
  base ROM, right in your browser (alttpr.com's generator and Kara's run locally;
  Kara's server, AVIANART and alttpr.com seed links are fetched online). Your
  sprite, music and other options go on last.
- **Playing.** The ROM goes straight into Snes9x. In-game saves are kept per seed;
  the **⋯** menu on the game has save states, filters, volume and controls.
  Keyboard: F5 save state, F8 load state, hold <kbd>`</kbd> to fast-forward.
- **Tracking.** The Snes9x core shares its memory with the page, so the tracker
  reads items, keys, dungeon progress and location checks directly as you play.
  Hutch's tracker thinks it's talking to a real SNES over SNI; a small shim in
  the page answers it instead, so his tracker runs unmodified.
- **Saving your stuff.** Base ROM, settings, presets, saves and Resume live in your
  browser's storage on this site. Nothing is uploaded.

## Crowd control (TikTok LIVE)

Viewers' gifts, likes, follows and shares change your game while you stream:
hearts, magic, rupees, bombs, arrows, inverted controls, ice physics, cucco
attacks, instant death and one-hit KO, random sprites or music, and brand-new seeds
(same settings, a random preset, or full CHAOS) for big donations. Plus:

- **Gear:** shield gone / stolen / up / down, sword gone / down / up (and *sword
  stolen*, which asks first since it can end a run), tunic up / down, +1 / −1 heart
  container, and *item gone* (any item Link has, for 30 seconds).
- **Enemies:** *any enemy* (one of 74, anywhere, even in an empty room), extra
  enemies, and the Halloween set (Monster mash, Spooky monster, Haunting…).
- **The room:** *Lights on!* / *Lights out!*, Blood drip, Spiderwebs, Spooky night.
- **Help:** *reveal a go-mode item* shows where something the run still needs is
  (seeds made in the hub; race seeds keep their spoiler hidden).
- **Live games** for chat: guess the Ganon's Tower chest with the big key (`!gt`) or
  the Digging Game dig with the prize (`!dig`).

There's also a **subathon clock** (gifts, likes, follows, shares, comments, checks and
bosses add time) and a **scrolling gift list** for OBS / TikTok LIVE Studio. With
*Rerolls can land on either game*, new-seed gifts can switch between Zelda 3 and
Zelda 1 (never The Guardian Legend). The ROM is never changed; any seed works.

```
TikTok LIVE ──► your LIVE page (Chrome/Edge window) ──► Crowd Control+ ──ws://localhost:21214──► Rando Hub ──► Snes9x
                                                         │
                                                         └──► control panel + stream overlays (http://localhost:21214)
```

Crowd control is **Crowd Control+**, the second download on the
[Releases page](https://github.com/hugecrankhank/Rando-hub/releases/latest): the gift
bridge plus a control panel and stream overlays (gift alerts with sounds, goal bars,
top gifters, chat votes, team battles, mystery box, boss detours, read-aloud and more).

**Setup (about 15 minutes, once):**

1. Download **`Crowd-Control-Plus-v<version>.zip`** from the
   [latest release](https://github.com/hugecrankhank/Rando-hub/releases/latest) and unzip it.
2. Install [Node.js](https://nodejs.org) (LTS). You also need Chrome or Edge.
3. Double-click **`Start Crowd Control+.bat`** (Mac: the `.command` file). The control
   panel opens in your browser at `http://localhost:21214/studio`.
4. **Dashboard → TikTok connection:** type your TikTok name and click **Connect**. This
   is the **local signer** (recommended): Crowd Control+ opens your LIVE page in its own
   Chrome / Edge window (log in to TikTok there once, keep it open; it's muted) and reads
   gifts, likes, follows, shares and chat from it. Free, no other apps, no keys.
   If a TikTok update ever breaks it, pick **TikFinity (backup)** there instead: the
   free [TikFinity](https://tikfinity.zerody.one) app does the listening.
5. In Rando Hub on the **same PC**: **⋯ → Crowd effects** → turn on, address
   `ws://localhost:21214`. Allow local-network access if the browser asks.
6. Test effects from either place (the game's **⋯ → Crowd effects** or the control
   panel's **Gifts & effects → Test any effect**), then go live.

Gifts are set up in the control panel (no file editing). The beginner-friendly guide is
[`crowd-plus/INSTRUCTIONS.txt`](crowd-plus/INSTRUCTIONS.txt); the technical overview of
the effects is [`crowd/README.md`](crowd/README.md).

The original panel-less Crowd Control is retired (it's kept in
[`archive/crowd-control-standard`](archive/crowd-control-standard), and in every release up
to v1.3.7). Its `mapping.json` works as-is in Crowd Control+.

## Downloads and versions

The website always runs the newest version. Each version is also published on
the **[Releases page](https://github.com/hugecrankhank/Rando-hub/releases)** as
`Rando-Hub-v<version>.zip`, a complete frozen copy, so any older version can still
be played later. Inside:

```
Rando-Hub-v1.0.0/
├── INSTRUCTIONS.txt              start here
├── Start Rando Hub (Windows).bat play this version from your computer
├── Start Rando Hub (Mac).command
├── start-rando-hub.sh            (Linux)
├── serve.mjs                     tiny local web server the Start files use
├── app/                          the whole app, exactly as released
├── Relays (optional)/            Cloudflare Worker sources for your own relays
├── README.md
└── CHANGELOG.md
```

Streamers also grab the second download, **`Crowd-Control-Plus-v<version>.zip`**
(crowd control): the gift bridge plus a control panel (`http://localhost:21214/studio`) and
OBS / TikTok LIVE Studio overlays: gift alerts with sounds, goal bars, top gifters,
recent events and chat command replies, plus reading chat aloud, chat votes, team
battles, a mystery box, a combo meter, predictions, run stats, death tax, clip
markers, a hall of fame and welcome-back pop-ups. Its `INSTRUCTIONS.txt`
walks through setup. Source: [`crowd-plus/`](crowd-plus).

Playing from the zip needs [Node.js](https://nodejs.org) (or Python 3) and runs at
`http://localhost:8067/`. The zip copy keeps its own saves, separate from the
website's. Kara's server and race seeds only answer the website, so from the zip
her seeds are made in the browser instead. What changed in each version:
[CHANGELOG.md](CHANGELOG.md).

---

# Feature guide

## Layouts

- **Phone** (iPhone and other phones): the game on top, then **Items / Keys**,
  **Light World** and **Dark World** buttons to switch the one tracker panel below it,
  sized to fit the screen with no scrolling. The header's controls are behind **⚙**.
  Turned sideways, the game is on the left and the panel on the right.
- **iPad**: the game on top, the items and dungeons under it, and both maps below
  (upright) or in a column beside it (sideways). With Mudora the items run in two long
  rows with the counters beside them (checks, deaths, bonks, the GT big key game and
  the Digging Game), and the 13 dungeons as a row of small cards.
- **Tablet** (other tablets), **Desktop** with pop-out tracker windows, and **Classic**.

**Layout → Auto** picks Phone on phones, iPad on an iPad, Tablet on other tablets and
Desktop on a computer. A layout picked by hand always wins.

## Customizer and presets

In the **Randomizer** bar (alttpr.com generator), **Customizer** holds alttpr.com's Customizer menus, each
its own dropdown: Settings, Logic, Starting Equipment, Item Pool, Locations, Prize Pack Pool, Prize Packs
and Game Details. Turn on **Use the customizer when generating** and **Generate & Play** makes a seed from
them, with the same code alttpr.com uses. Tap **?** beside a setting for what it does.

**Saved presets** (the first field in the Randomizer bar) hold every generator's setups in one list. A
preset knows which generator it's for (alttpr.com, Kara's branch or AVIANART), so picking one switches
to that generator and sets it up; then press **Generate & Play**. The list goes **★ Favorites** (tap **☆**
beside the list to star the chosen preset, any kind), **Your presets**, **Built-in**, then each site's own. Built-in
(**OnlyADKDF** rolls AVIANART's `jem041/onlyadkdf` and turns on the tracker's OnlyADKD mode). **Save**
keeps the current generator and its settings (for alttpr.com, the bar's settings and every customizer
menu) under a name; **Delete** removes one of yours. **Export** saves your presets to a file, **Import…**
adds them back (or reads a Save file from alttpr.com's own Customizer). Customized seeds can't be shared
as a seed link; share the preset file instead.

## Playing offline

Press **Make available offline** (Randomizer bar → **ROM options** → Offline use) once while
online. It downloads everything the app needs, including the emulator and both seed
generators (Kara's runs on Python in the browser, about 15 MB), so the app opens and
plays in airplane mode. The button then shows **✓ Available offline**, and after an
update the offline copy refreshes itself the next time you're online.

Works offline: generating seeds (alttpr.com's generator, and Kara's with **Made by →
This browser**; her server falls back to it), the tracker, your base ROM, sprite, MSU
pack, settings and saves. Needs internet: Kara's server and race seeds, alttpr.com seed
links, and browsing the sprite library.

On iPhone/iPad, also **Share → Add to Home Screen** and open it from there: iOS can
clear a website's saved files after a few weeks without use, but not a Home Screen app's.

## Trackers: Mudora 2.0, Mudora, Hutch's or off

The **Tracker** choice in the header (behind ⚙ on phones and iPads) switches straight
away, mid-game too:

- **Mudora 2.0 (Muffins logic)**, the default: Mudora's look with the logic and
  settings of [Muffins' Tracker 2.0](https://github.com/KrisDavie/alttptracker)
  (`mudora2/`). His tracker runs out of sight (`mfns-tracker/`, built unchanged from
  his source) and Mudora 2.0 shows its answers. Each seed rolled in the hub starts a
  new game in it with the seed's settings; **⚙ Settings** has all his game and logic
  settings (changeable mid-game), every one of his 67 presets with a search box, his
  launch page and entrance menu, and Autotracking details. Logic problems: Muffins'
  Discord; how it looks or runs here: Rando Hub.
- **Mudora (Hutch logic)**: the same look with Hutch's logic (`mudora/`); his tracker
  runs out of sight and both stay in step.
- **Hutch**: his tracker as he makes it, `tracker/`, his
  [ALTTPR-Tracker](https://github.com/hutchch/ALTTPR-Tracker).
- **Hutch Beta**: `tracker-beta/`, the release with the files from his
  [ALTTPR-Tracker-Beta](https://github.com/hutchch/ALTTPR-Tracker-Beta) laid over
  it. That repository only holds the files a beta changes, and is empty between
  betas; then there's no `tracker-beta/` and Beta shows "same as release right now".
- **Off**: no tracker is loaded and the game fills the screen under the header,
  in every layout. With the on-screen controller showing it moves off the
  picture: under it when a phone or iPad is upright, on both sides when
  sideways. With a tracker on, the controller overlays the game as before.
  On computers, Timer and Game only stay in the header.

**⚙ Settings** in the header holds the tracker settings: Tracker world and Tracker
dungeon items (for the trackers with Hutch's logic), Tracker keys (Found `1/6`, In hand
`0/6` or Both `1(0)/6`) and **Item sounds**: sound packs (a folder per item, a random
sound on each pickup) that play with every tracker. It also has **📜 Seed history**
(every seed started here, Zelda 1 and GLR too: when, the seed and its code, who rolled
it and how, with a link to play it again and a CSV download) and **⭐ Credits**.

### Mudora

Rando Hub's own tracker, named after the Book of Mudora (it reads the old writing; this
one reads your game). Everything it shows comes from the game being played:

- **Items** cut from the game's own pause menu by a hidden copy of the emulator, so a
  randomizer's menu and a custom sprite's look come along. **Icons** can be the game's
  pixels, Smooth (Scale2x, twice), or your own PNGs, item by item.
- **Both worlds drawn from the ROM**, sharp at any zoom, with a check's pin on the real
  door, cave, item or person. Zoom with the wheel or a pinch, drag to move, ⟲ to reset.
- **Clicking a check marks it done**; right click (press and hold on a phone or iPad)
  opens its card to mark which item is there, or tick off the places in a square one
  by one. Items: click up, right click back.
- **Dungeons:** prize (crystals and pendants in their own colours, bright once you have
  them), big key, map, compass, small keys (green once all found) and chests left, and
  dungeon maps three ways: *Explore* (fills in as you walk), *Map* (like the pause map)
  and *Full* (every room up front, desktop). **This dungeon** shows the boss, prize,
  keys and chests of the dungeon Link is in; **⧉ Dungeon card** puts it in a window of
  its own for OBS. **List** can show only the ready dungeons, or only this one.
- **Prizes from the game's map:** whatever crystal or pendant the game draws on its world
  map (X) is copied to the tracker; a button by each dungeon opens a picker for the rest.
- **Entrances** on entrance-shuffle seeds: each door and hole where it is, filled in as
  you walk through it (only the door you used is read, so nothing is given away).
- **Counters:** checks (out of the places there are), deaths, bonks, the GT big key game
  and the Digging Game, read from the game; **Visible** checks (orange) you can see but
  not reach yet; go-mode reveals from crowd control marked on the map.
- On phones the options fold behind its ⚙; on an iPad it uses the iPad layout above.

`tools/update-hutch.py` refreshes both copies from his repositories (keeping
the SNI shim line and the bottle pictures) and writes
`tracker/hutch-versions.js`, which the menu reads for the version numbers. The
deploy workflow runs it, so the site picks up his updates on every deploy and
weekly; `--check` shows what would change.

## Desktop layout and pop-out windows

- **Layout → Auto** picks *Desktop* on a computer with a mouse or trackpad (window
  wider than 900px) and the tablet layouts on touch screens. *Desktop* can also be
  picked directly.
- **Pop out → Items / Dungeons / Light World / Dark World** opens that piece in a
  window of its own. All four can be out at once, each in its own window, or
  combined: tick another piece in a window's options to bring it into that window
  (both worlds in one map window, say). Everything keeps tracking live, and clicks
  work the same everywhere: marking items, cycling prizes, checks, the dungeon hover
  card, menus and settings. The game grows into the space pieces leave; with all
  four out, the main window is just the game.
- **Put a piece back:** untick it in its window's options, close its window, press
  **Dock** there, or click its (green) **Pop out** button again.
- **Window options:** a small ☰ appears in the corner while the mouse moves over a
  pop-out; point at it for the options. Otherwise the window shows only the tracker,
  ready to capture.
  - The pieces in this window, and the ones that could join it.
  - *Arrange* (both worlds): side by side, stacked, or whichever fits best.
  - *Item rows:* how many rows the items wrap onto, or whichever fits best.
  - *Background:* the tracker's own, black, or green/blue/magenta for an OBS
    Chroma Key filter.
  - *Fit:* the pieces grow or shrink with the window.
  - *Clean:* hides the tracker's menu bars, in the window that has them (see below).
  - ⚙ opens the tracker's settings in this window. 📌 keeps the options showing.
- **Menu bars** (the item tracker's bottom bar; the map's top and bottom bars) stay
  in the main window while any piece of that tracker is there, and otherwise go to
  the window with its first piece.
- Each window remembers its size, position and options, and reconnects by itself
  when the main window reloads (a new ROM).
- **Stream windows** opens two windows set up for capture in one click: items +
  dungeons in one, both worlds side by side in the other (black background, fitted,
  no menu bars). If the browser only allows one new window per click, click again
  for the second. Click once more to put them back.
- **Stream** opens one window with everything (items and dungeons on top, both
  worlds below) for a single capture. Its ☰ at the top right sets the maps below or
  beside the items and one background for both; drag the line between them to
  resize. Each half has its own ☰ at its top left for item rows, Fit and Clean.
- **Broadcast** and **Timer** open Hutch's own broadcast view (a stream overlay of
  items and dungeons) and timer, connected to the game the same way.
- **Game only** hides everything but the game, edge to edge, for capture. Esc (or
  *Show trackers* at the top right) brings it back.
- **Resize the tracker column** by dragging its left edge; double-click to reset.
- In Desktop the item tracker uses Hutch's tablet arrangement (items in rows, then
  a row of prize counts and dungeons), which is what lets the items and the dungeons
  go to separate windows.

**Capturing in OBS:** add a *Window Capture* per window. They're titled by what
they hold (*ALTTPR Items*, *ALTTPR Dungeons*, *ALTTPR Light World + Dark World*…).
Use a solid background plus a *Chroma Key* filter to drop the background.

Things to know:

- **Allow pop-ups** for the site the first time. If the browser blocks a window, a
  note says so; allow pop-ups from the address bar and click again.
- **Keyboard input goes to the window you last clicked.** After clicking a tracker
  window, click the game before playing on the keyboard. A controller isn't
  affected.
- **Keep the game window at least partly visible.** Browsers slow a fully hidden or
  minimized window down, and the game with it. (The game isn't paused when the
  window is covered.)
- **Closing the main window** leaves the pop-outs showing their last state; open the
  app again and pop pieces out from there.

### How the pieces stay in step

There's only ever one item tracker and one map. Hutch's tracker can't run as two
copies: its autotracking applies only what changed in game memory since its own
last read, so two copies a moment out of step could disagree for good, and each
would send the map its own item list. So both trackers keep running in the main
window, and popping a piece out moves that piece's live page elements into the
pop-out window (`portal.js`). The tracker keeps updating them and their click
handlers keep working, so nothing needs syncing and nothing restarts. To make that
work without touching Hutch's code:

- his `document.getElementById` / `querySelector` lookups are widened to also find
  pieces that are in other windows;
- his stylesheets and the classes on his `<html>` / `<body>` are copied to each
  pop-out and kept current, and the containers a world sat in are recreated around
  it;
- handlers he put on the whole page (closing a menu on an outside click, the
  dungeon hover card, hotkeys) are added to each pop-out too
  (`bridge/sni-shim.js` records them as he registers them);
- a menu, hover card, tooltip or settings panel he opens appears in the window you
  were using when it opened.

### The tablet layouts

- *Tablet:* items on top, Light World left, game in the middle, Dark World right,
  dungeons along the bottom (Hutch's own tablet view, `js/mobile.js` in
  [his tracker](https://github.com/hutchch/ALTTPR-Tracker)). The **−** / **+** at the
  bottom left of the item tracker resize the maps; the game takes the rest.
- *iPad:* the game with the items and dungeons under it, and both maps at full
  size (side by side when upright, in a column on the right when sideways). With
  Mudora, `mudora-stack.js` lays Mudora out the same way around the game.
- *Classic:* the original layout, with the game and both trackers on one page.

## Other games: Zelda 1 and The Guardian Legend

The **Game** row at the top of the Randomizer bar (and **Zelda 1 ▸** / **GLR ▸** in the
header) switches games. Each is its own app inside the hub, with its own emulator,
seed generator, tracker and saves, and buttons back to the others.

- **Zelda 1** (`z1r/`):
  seeds made by [ZORA](https://github.com/tetraly/zora) from your own Legend of Zelda
  (USA) ROM. Crowd control works there too: effects both games have keep their names,
  ALTTP-only ones are skipped. **Rerolls can land on either game** lets 🎲 Reroll and
  Crowd Control's random preset / CHAOS seeds pick Zelda 3 or Zelda 1 at random
  (*New seed (same settings)* always stays in the game being played).
- **The Guardian Legend** (`glr/`):
  seeds from your own Guardian Legend (USA) ROM, with the labyrinth map drawn from the
  ROM. Only ever picked by hand: rerolls and crowd control never switch to it.

Both seed generators are **beta**: new and not fully vetted yet, so a seed may have
mistakes; please report anything odd. Both live in this repository (each folder is a
complete app with its own README; `hub.js` in each is what connects it to the hub).
They started as separate repositories for beta testing, now archived.

## The Randomizer bar

The settings bar under the header folds away when a game starts, and again whenever
you go back to playing with it open: a click on the game, a controller button, or a
game key (typing in its boxes doesn't count). **Randomizer** at the top left
brings it back.

## Kara's branch

The arrow on the **Randomizer** button (top left) picks the generator: **Kara's branch** switches the settings to
Kara's: her presets (Default, Boots, CrossKeys, Super Quick, Mimic Hellrule,
CrissCross Boss, Approximate Bunday, wjbCross, BossHunt Keys) and her settings,
including door shuffle, overworld shuffle, entrance shuffle, pottery and drop
shuffle. The main ones are in the bar; the rest are under **More Kara settings**.
Hover a setting for her help text. **Generate & Play** works as usual and uses
the same Base ROM, sprite, MSU-1 pack and ROM options.

**Made by** picks where seeds come from:

- **Kara's server** (the default, with Kara's permission): the app asks
  api.alttpr.gwaa.kiwi for the seed, exactly as her site does, so the seeds are
  the same games her site makes and they open on her site too. **Seed type →
  Race** makes a race seed with her race setting: its spoiler stays on her
  server. **Share seed** copies the seed's alttpr.gwaa.kiwi link, and pasting
  such a link into **Load a seed** plays it here. The ROM is built as her seed
  page builds it: her patch onto your Japanese 1.0 ROM, then the options her page
  offers (sprite, heart beep, quickswap, music off for an MSU pack) with her
  page's defaults for the rest. Nothing else is written to her seeds; menu speed
  is hidden for them because her site doesn't offer it. If her server can't be
  reached, a normal seed is made in the browser instead (with a note), and a
  race seed isn't made at all. Her server only answers this app once her site
  allows its address, `https://hugecrankhank.github.io`.
- **This browser**: her generator runs here, described below. Also used when
  you type a seed number, since her server picks its own.

How making seeds in the browser works:

- Her generator ([alttpr-python](https://git.gwaa.kiwi/alttpr-gwaa-kiwi/alttpr-python),
  MIT, built on Aerinon's Door Randomizer and codemann8's Overworld Randomizer)
  is in `randomizer/kara/alttpr-python`, pinned to the commit in
  `randomizer/kara/index.js`. It runs in the browser on
  [Pyodide](https://pyodide.org) (Python compiled for the web), in a worker so
  the page stays responsive. Nothing goes to Kara's servers or anyone else's.
- The first Kara seed downloads Python (about 15 MB, then cached). Python starts
  in the background as soon as you pick Kara's branch, so it's usually ready by
  the time you press Generate. A normal seed takes several seconds; big shuffles
  (Approximate Bunday, say) can take a minute or more. **Stop** cancels.
- The settings are turned into her generator's options the same way her server
  does it (`randomizer/kara/settings.js`), including the extras it adds (tavern
  shuffle, dungeon counters). Like her server, a random seed that can't be
  finished with those settings is retried with a new random seed, up to five
  times. A seed number you type is used as is.
- The ROM is built the way her generator builds one: your Japanese 1.0 ROM, her
  base patch (`data/base2current.bps` in her code), the seed, then your ROM
  options and sprite.
- **Seed and race links** work as for alttpr.com-style seeds. Kara links look
  like `?gen=kara&seed=…&k=goal:fast_ganon,…`, and opening one switches the bar to
  Kara's branch with the link's settings. The same seed and settings give the
  same game for everyone (checked: same ROM byte for byte, in separate browsers),
  so compare the five-item code as usual. Every seed is made in a fresh Python
  with a fixed hash seed, which is what makes that work.
- Seeds made in the browser are not the same games as seeds made on
  alttpr.gwaa.kiwi with the same number, because Python there runs on a
  different platform. Their race links are honor system (the spoiler is hidden,
  not sealed); for a real race, use **Made by → Kara's server** and **Race**.
- **Tracker.** Hutch's tracker is told what it understands: world state,
  shuffled maps, compasses and keys, universal keys, entrance shuffle, shops,
  pottery, enemy drops, pseudo boots and the mirror scroll. It doesn't follow
  door shuffle, overworld shuffle, flute spots or prize shuffle; the status line
  says so when a seed uses them.
- Only her main generator ("Base") is included, not her Beta, Pikit or April
  2025 ones, or Mystery and multiworld.

Updating to a newer version of her generator: replace `randomizer/kara/alttpr-python`
with the new code (the same files as now), update `KARA_COMMIT` in
`randomizer/kara/index.js`, and run `python3 tools/kara-data.py <her alttpr-frontend>/src/data
randomizer/kara/settings-data.js` if her settings changed. Seed links made before
the update say they came from another build.

## Seed links and races

After **Generate & Play**, two buttons copy a link to that seed:

- **Share seed** — opens the same settings and seed number for whoever clicks it.
- **Race link** — the same, with the spoiler download hidden for them.

Opening a link shows the seed and its settings at the top of the Randomizer bar;
**Play this seed** generates it. Nothing is uploaded: the generator is deterministic,
so the same seed number and settings make the same game in everyone's browser, from
each player's own base ROM. Each player keeps their own sprite, music, heart beep,
menu speed and quickswap.

**Check the code.** Next to the seed number is the five-item code the file select
screen shows (it's read from the ROM, so it works for seed files from alttpr.com
too). Everyone in a race should see the same five items.

Race links run on the honor system: the seed number is in the link, so someone
determined could still work out the spoiler. For a sealed race, generate the seed on
alttpr.com with spoilers off and share that. Links carry a generator version
(`v=`); one made with a different version of this app says so, as the game might
differ (compare codes).

## Loading a seed: paste a link or a number

**Load a seed** (Randomizer bar) takes any of these; paste it and press **Load** or
Enter. Pasting a link anywhere on the page (outside a text box) works too.

- **A seed link from this app** — plays that seed with its settings (as opening the
  link would).
- **A seed number** — plays that number with the settings currently chosen.
- **An alttpr.com seed** — a link like `https://alttpr.com/h/AbC123xyZ9`, or just the
  10-character id. The app downloads the seed and builds the ROM in your browser the
  way alttpr.com's own page does: alttpr.com's base patch for that seed's version onto
  your Japanese 1.0 ROM, then the seed, then your sprite, music and other options
  (quickswap stays off if a race seed locks it). The tracker is set to the seed's
  world state, dungeon items, swords, GT crystals, boss shuffle and enemizer, and the
  five-item code is read from the seed. **Share seed** copies its alttpr.com link.
  Base patches for other versions are downloaded once and kept.

### Loading alttpr.com seeds: the relay

alttpr.com doesn't let web pages on other sites read its seeds, so the app asks a
small relay and the relay asks alttpr.com. A built-in relay is already running, so
this works with no setup; see [The seed relays](#the-seed-relays) to run your own.

### AVIANART seeds

**AVIANART** is the third generator in the menu beside **Randomizer** (with alttpr.com and Kara's
branch). It rolls seeds on [avianart.games](https://avianart.games) (its Door Randomizer server, the one
PedChicken uses on Discord) and plays them here. Its presets are in **Saved presets**, grouped
**AVIANART · Main**, **AVIANART · Ladder** and so on (its whole list, fetched from the site; a copy is
built in), plus **Type a player's preset…** for names like `jem041/onlyadkdf`. Or set up your own with
**AVIANART settings**: **Items**, **Entrances**, **Dungeons** and **Enemizer**, the same settings as
AVIANART's customizer (Door Randomizer 1.5.7-u; `tools/avianart-settings.py` rebuilds them). Changing
any of them switches Generate & Play from the preset to your settings; **Save as preset** keeps them.
**Race** hides the spoiler. Pasting an AVIANART permalink (`https://avianart.games/perm/…`) into
**Load a seed** plays that exact seed, so everyone in a race can load the same one.

The ROM is built in your browser from your Japanese 1.0 ROM, then your sprite, music and
other options go on. The tracker follows the seed's world state, dungeon items, GT
crystals, entrance shuffle and key drops; the **OnlyADKDF (jem041)** preset also turns on
the tracker's OnlyADKD mode. **Share seed** copies the AVIANART permalink.

The app asks AVIANART directly first. If AVIANART doesn't let other sites read it, it uses
a relay instead (built in; see [The seed relays](#the-seed-relays) to run your own, which
goes in **ROM options → AVIANART relay**).

## Sprites

The **Link sprite** setting (Randomizer bar) shows a preview of the current sprite.

- **Library…** browses the [alttpr.com sprite library](https://alttpr.com/en/sprites):
  search by name, author or tag, filter by tag, or pick one at random. Previews and
  sprite files come straight from alttpr.com's file host.
- **File…** uses your own `.zspr` or `.spr`. Its preview is drawn from the file
  (Link's head); click it to see the whole sprite sheet.
- **Default** goes back to Link.

A few sprites in alttpr.com's list (27 of 513 at last check) have no preview picture
on its file host; for those the library draws Link's head from the sprite file instead.
The library's plain *Link* entry has no file there either, so picking it is the same as
**Default**.

The sprite applies to every seed you generate until you change it. The library's list
comes from alttpr.com/sprites, which browsers can't read from other sites, so the
deploy workflow copies it into the site as `sprites.json` on every deploy and once a
week (a copy in the repository is the fallback).

## Running and hosting it yourself

It must be served over HTTP: opening `index.html` as a file won't work, because
the browser blocks the emulator and the tracker frames on plain files.

```bash
git clone https://github.com/hugecrankhank/Rando-hub
cd Rando-hub
python3 tools/kara-bundle.py      # packs Kara's generator (for Kara's branch)
sh tools/fetch-pyodide.sh         # downloads Pyodide, the Python her generator runs on
python3 -m http.server 8080       # or: npx serve .
```

Then open http://localhost:8080. (Or use the release zip's Start files, which do
all of this for you.)

**GitHub Pages (how the official site runs):** the `Deploy to GitHub Pages`
workflow (`.github/workflows/deploy.yml`) publishes the site on every push to
`main` and once a week. Each deploy refreshes the sprite list from alttpr.com,
pulls Hutch's newest tracker (`tools/update-hutch.py`), packs Kara's generator
and downloads Pyodide. To set it up on a fork: **Settings → Pages → Source:
GitHub Actions**.

**Hosting somewhere other than `hugecrankhank.github.io`:** add your site's
address to `ALLOWED` in both relay workers (and deploy your own relays, below),
and to `allowedOrigins` in `crowd-plus/mapping.json`. Kara's server only
answers sites she has allowed, so elsewhere her seeds are made in the browser.

### The seed relays

alttpr.com and AVIANART don't let pages on other sites read their seeds, so the
app asks a small relay and the relay asks them. Two free Cloudflare Workers are
already running and built in, so nothing needs setting up. To run your own:

| Relay | Source | Built-in address |
|---|---|---|
| alttpr.com seeds | [`relay/alttpr-worker.js`](relay/alttpr-worker.js) | `https://alttpr-relay.hugecrankhank.workers.dev` |
| AVIANART seeds | [`relay/avianart-worker.js`](relay/avianart-worker.js) | `https://avianart-relay.hugecrankhank.workers.dev` |

1. Make a free account at [dash.cloudflare.com](https://dash.cloudflare.com).
2. **Workers & Pages → Create → Create Worker**, name it (`alttpr-relay` or
   `avianart-relay`) and press **Deploy**.
3. **Edit code**, replace everything with the file's contents, **Deploy** again.
4. Copy the worker's address and paste it in the app under **Randomizer → ROM
   options** (*alttpr.com relay* or *AVIANART relay*). Empty the box to go back to
   the built-in one.

Both only pass on what the app needs, only for the sites in their `ALLOWED`
list (plus `localhost`), and keep seeds for a day so a race asks the seed site once.

## Releasing a new version

1. `python3 tools/set-version.py 1.1.0` (updates the header and version tag).
2. Add a `## 1.1.0` section at the top of [CHANGELOG.md](CHANGELOG.md).
3. Commit and push to `main`.

That's it. The website updates, and the `Release` workflow
(`.github/workflows/release.yml`) sees a version with no release yet, builds
`Rando-Hub-v1.1.0.zip` with `tools/make-release.py` and the Windows app
`Rando-Hub-Beta-Windows-v1.1.0.zip` from it (`desktop/`), creates the tag `v1.1.0` and
publishes them on the Releases page with that version's changelog as the notes.
The Windows apps already out there see the new release and offer the update.
Pushes that don't change the version don't make a release. Old releases stay
up, so every version remains downloadable and playable. To build the zip
yourself: `python3 tools/make-release.py` (output in `dist/`).

---

# Under the hood

## Repository layout

```
index.html, *.js        the app: layouts (phone.js, tablet.js, desktop.js), pop-outs (portal.js,
                        popout.html), header, Reroll, OnlyADKD mode, offline mode (offline.js, sw.js)
emu/                    Snes9x compiled to WebAssembly and its player, input, video and audio
bridge/                 memory bridge to the tracker (sni-bridge.js) and the fake-SNI shim
tracker/                Hutch's tracker (refreshed from his repository on every deploy)
mudora/, mudora2/       Mudora (Hutch's logic) and Mudora 2.0 (Muffins' logic)
mfns-tracker/           Muffins' Tracker 2.0, built unchanged; Mudora 2.0 runs it out of sight
addons/                 item sounds, keys in hand, map prizes and other additions to the trackers
z1r/, glr/              the Zelda 1 and Guardian Legend apps (each complete, with its own README)
sounds/                 item sound packs
randomizer/             alttpr.com generator (JS port), Kara's branch, AVIANART, presets, sprites, MSU
crowd/                  crowd control's game side: effects.js (in the app)
crowd-plus/             Crowd Control+ (runs on your PC): gift bridge, control panel, stream overlays
archive/                retired code kept for reference (the original panel-less crowd control)
relay/                  Cloudflare Worker sources for the alttpr.com and AVIANART relays
release/                what goes in the release zip besides the app (INSTRUCTIONS.txt, Start files)
tools/                  deploy and release scripts
```

## The emulator (`emu/`)

```
emu/snes9x.wasm      libretro Snes9x built with wasi-sdk (no Emscripten)
emu/build/           glue.cpp (tiny libretro frontend) and build.sh
emu/core.js          loads the wasm (minimal WASI shim)
emu/video.js         WebGL2 multi-pass shader runner (emu/shaders/*.glsl)
emu/audio.js         AudioWorklet output with drift correction
emu/input.js         keyboard, gamepads, on-screen controller
emu/player.js        the player in the game box; publishes window.EJS_emulator
                     (getState/loadState, pause/play, volume) for the app
```

Rebuild the core (optional, `emu/snes9x.wasm` is committed):

```bash
git clone https://github.com/libretro/snes9x
WASI_SDK=/path/to/wasi-sdk-25.0-x86_64-linux SNES9X=/path/to/snes9x ./emu/build/build.sh
```

Licenses: Snes9x (non-commercial, `emu/build/LICENSES/snes9x-LICENSE`),
libretro shaders (each file's header; xBRZ is GPL-3.0).

## How the tracking works

```
index.html  (desktop.js: Desktop layout, pop-outs; tablet.js / phone.js: other layouts)
├── emu/  Snes9x (WebAssembly)   ← exports its WRAM, SRAM and ROM to the page
├── bridge/sni-bridge.js         ← reads live memory, speaks usb2snes addresses
├── <iframe> tracker/itemtracker.html, tracker/map.html   (Hutch)
└── pop-out windows: popout.html → portal.html, holding pieces moved from those
        └── bridge/sni-shim.js   ← swaps WebSocket for an in-page fake SNI
```

1. **Direct memory.** The Snes9x core is built with its memory exported, so
   `bridge/sni-bridge.js` reads and writes WRAM, SRAM and the ROM directly: no
   save-state snapshots or heap searches. Live sprite changes and crowd effects
   write straight into the running game.
2. **Fake SNI.** Hutch's tracker connects to `ws://localhost:23074` and sends
   usb2snes JSON (`DeviceList`, `Attach`, `GetAddress`). The shim answers those from
   the bridge using SD2SNES address mapping:
   `F50000+` → WRAM, `E00000+` → SRAM, `000000+` → ROM file.
   Because his tracker thinks it's talking to SNI, its code is untouched, so his
   updates drop straight into `tracker/`.

In the Desktop layout (`desktop.js`, `portal.js`, `popout.html`), pop-out
windows show pieces of the two trackers that run in the main page; see *How the
pieces stay in step* above. Each pop-out asks the main page once a second what it
holds, which is also how it reconnects after the main page reloads for a new ROM.

Two additions to Hutch's files: seven bottle pictures (`tracker/items/bottle_*.png`:
empty, red, green and blue potion, fairy, bee, good bee) that his item tracker asks
for but his repository doesn't include yet, drawn from his own bottle outline; and,
in `bridge/sni-shim.js`, a guard that skips item updates that would change nothing
(his tracker re-applies every bottle on each memory read, which flickered). If his
repository gains its own bottle pictures, they replace these.

The only change to the Hutch files is one `<script>` line at the top of
`itemtracker.html`, `map.html`, `timer.html` and `broadcast.html`. Opened
outside this app, the shim does nothing and the tracker uses real SNI.

## The randomizer

`randomizer/` is a JavaScript port of the official ALttPR generator
([alttp_vt_randomizer](https://github.com/sporchia/alttp_vt_randomizer), the code
behind alttpr.com, build 2024-02-18) and runs entirely in the browser, in a
Web Worker.

```
randomizer/
├── app.js            ← the settings bar: base ROM, generate, patch, boot, downloads
├── worker.js         ← runs generate() off the main thread
├── generate.js       ← settings + seed → patch + spoiler (mirrors the alttpr.com API)
├── core/             ← Item, Location, Region, World, Randomizer, Rom, Text, …
├── regions/, worlds/ ← No Glitches logic for Standard / Open / Inverted / Retro
├── data/             ← base-patch.bin, config, text strings
├── tools/            ← converters, base-patch builder, PHP reference harness
└── test/             ← parity tests against the PHP original
```

How a seed is made:

1. Your Japanese 1.0 ROM (MD5 `03a63945…`) is stored in IndexedDB the first
   time you pick it. It never leaves the browser.
2. It's expanded to 2 MB and the base patch is applied. The base patch is
   z3randomizer (commit `dcb0a2b`, the version alttpr.com pins) assembled with
   asar; the result is checked against alttpr.com's base ROM MD5 (`edc01f3d…`).
3. The generator places items, writes the seed data, and returns a patch and
   spoiler. Heart beep, menu speed and quickswap are applied, then the checksum.
4. The ROM boots in the emulator and both trackers reload with the seed's
   world state, dungeon item shuffle, sword mode and GT crystal requirement.

**Same seed number + same settings = the same game**, so a seed can be shared
by its number. Some seeds can't be completed by the generator (the original
does this too); random seeds just roll again.

Supported: every alttpr.com option for No Glitches logic (world state, goal,
crystal requirements, swords, item placement, dungeon items, accessibility,
item pool and functionality, hints). Not included: glitched logic, entrance
shuffle, enemizer/boss shuffle, multiworld, tournament/race ROMs.

### Verifying the port

The port keeps the original's structure and order of operations, and the PHP
original can be run with the same seeded random number generator. For the same
settings and seed, both produce the same ROM bytes and the same spoiler:

```bash
git clone https://github.com/sporchia/alttp_vt_randomizer ../alttp_vt_randomizer
export VT_DIR=$PWD/../alttp_vt_randomizer         # needs PHP 8.1+
cd randomizer
node test/compare.mjs '{"mode":"inverted","dungeon_items":"full"}' 1 2 3
node test/logic.mjs '{"mode":"standard"}' 200     # per-location access logic
node test/sweep.mjs one                           # every option, one at a time
node test/sweep.mjs random 100                    # random combinations
```

Regenerating code from the PHP: `python3 tools/convert_regions.py` and
`python3 tools/convert_core.py` (the rest of `core/` is hand-ported).
Rebuilding the base patch: `python3 tools/make_base_patch.py <z3randomizer> data/base-patch.bin`.

## Debugging

In the browser console:

```js
AlttpBridge.status()             // mode: 'live' | 'snapshot' | 'idle'
AlttpBridge.peek(0x7EF340, 32)   // dump inventory bytes ($7EF340+)
```

## Known limits

- **No Glitches logic for alttpr.com seeds made in the app.** Kara's branch and
  AVIANART add entrance, door and overworld shuffles; for glitched logic, generate
  elsewhere and use **Load a seed** or **Load ROM…**.
- **Changing ROMs reloads the page.** Your game is stashed first, so nothing is lost.
- **Mudora 2.0 doesn't follow door shuffle or overworld shuffle** (neither do the other
  trackers); its logic is Muffins', so a logic question goes to him.
- **Crowd control needs a PC** running Crowd Control+ (or an `https` tunnel to it for
  phone play; see `crowd/README.md`). It changes the game mid-run, so it's not for races.
- Saves live in the browser's storage on the site you play from (the website and a
  zip copy are separate). On iPhone/iPad, install it to the Home Screen to keep them safe.

## Shout-outs

Rando Hub wouldn't be what it is without these people. Thank you!

| Who | For |
|---|---|
| **Gumby** ([@gumby.oo7](https://www.tiktok.com/@gumby.oo7)) | Play testing, development ideas |
| **HydeOutGaming** ([@jennkevden](https://www.tiktok.com/@jennkevden)) | Play testing, development ideas |
| **Heffie's Homies** ([@heffie638](https://www.tiktok.com/@heffie638)) | Play testing |
| **Hutch** | Tracker implementation, and modifications to fit tablet mode |
| **Kara** | Kara's randomizer branch, its settings and presets |
| **Muffins** | Muffins' Tracker 2.0, and the logic behind Mudora 2.0 |

They're in the app too (⚙ Settings → Credits), and in the game's own ending on every
ALTTP randomizer seed played in the hub (made here, by Kara's branch, AVIANART or
alttpr.com, or loaded from a file: the copy being played is patched when it starts): the joke captions of seven ending scenes become "playtested by
Gumby" and so on (`randomizer/hub-credits.js`; the captions that hint at items stay).

## Credits

- Tracker: [Hutch-ALTTPR Tracker](https://github.com/hutchch/ALTTPR-Tracker)
  by Hutch (hutchch), MIT License (see `tracker/LICENSE`).
- Muffins' Tracker 2.0 (the logic and settings of Tracker → Mudora 2.0): [alttptracker](https://github.com/KrisDavie/alttptracker)
  (`react_rewrite`) by Muffins / Kristofer Davie (MFNS), MIT License (see
  `mfns-tracker/LICENSE`), built unchanged. Tracker or logic bugs: his Discord;
  bugs in how it runs or looks inside Rando Hub: Rando Hub.
- Emulator: [Snes9x](https://github.com/snes9xgit/snes9x) (libretro core), non-commercial
  license (`emu/build/LICENSES/snes9x-LICENSE`); libretro GLSL shaders, each under
  the license in its header (xBRZ is GPL-3.0).
- Randomizer: ported from [alttp_vt_randomizer](https://github.com/sporchia/alttp_vt_randomizer)
  by sporchia (MIT); base patch built from [z3randomizer](https://github.com/KatDevsGames/z3randomizer)
  (MIT). See `randomizer/LICENSE-THIRD-PARTY.md`.
- Kara's branch: [alttpr-python](https://git.gwaa.kiwi/alttpr-gwaa-kiwi/alttpr-python)
  by Kara (karafruit), MIT License (LLCoolDave's original license, carried by every fork since;
  see `randomizer/kara/alttpr-python/LICENSE`), built on
  [ALttPDoorRandomizer](https://github.com/aerinon/ALttPDoorRandomizer) by Aerinon and
  [OverworldShuffle](https://github.com/codemann8/ALttPDoorRandomizer) by codemann8.
  Settings, presets and help text from her [alttpr.gwaa.kiwi](https://alttpr.gwaa.kiwi/generate).
  Runs on [Pyodide](https://pyodide.org) (MPL-2.0), downloaded when the site is deployed.
- AVIANART seeds: [avianart.games](https://avianart.games).
- Zelda 1: seeds by [ZORA](https://github.com/tetraly/zora) by Tetra (MIT, `z1r/zora/LICENSE`);
  Zelda 1 and The Guardian Legend run on [libretro FCEUmm](https://github.com/libretro/libretro-fceumm)
  (GPL-2.0, `z1r/core/LICENSES/`). See `z1r/README.md` and `glr/README.md`.
- An earlier web EmoTracker (the official ALTTPR pack by EmoSaru, MIT, on
  [fengari](https://fengari.io)) is kept in `emotracker/` but no longer offered as a tracker.
- Link sprites: the [alttpr.com sprite library](https://alttpr.com/en/sprites) and its artists.
- TikTok connection: [TikFinity](https://tikfinity.zerody.one).
- Logo lettering: [Press Start 2P](https://fonts.google.com/specimen/Press+Start+2P) by CodeMan38,
  SIL Open Font License (`fonts/PressStart2P-OFL.txt`).

No ROMs are included; use your own legally obtained copy. Rando Hub is a fan project
and is not affiliated with or endorsed by Nintendo.

## License and permission

Copyright (c) 2026 Hank (hugecrankhank). Rando Hub, including Crowd Control+, is
licensed under the [PolyForm Strict License 1.0.0](LICENSE.md): free to use for
noncommercial purposes, and (an added permission) on streams and videos, monetized ones
included. Copying the code, changing it, sharing or re-hosting copies, or other
commercial use needs written permission: open an issue titled **"Permission request"**
on this repository. The parts by other people listed in Credits keep their own licenses.
Details: [NOTICE.md](NOTICE.md).
