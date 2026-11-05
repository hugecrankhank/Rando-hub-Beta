# Zelda 1 + Metroid, linked (Rando Hub)

Rando Hub's own take on a Zelda 1 / Metroid combo: the two games run in the
hub's NES emulator, one at a time, joined by portals and one item pool. Nothing
of anyone else's randomizer is used; the games come from your own two ROMs.

## What it does

- **Roll a seed** from your own The Legend of Zelda (USA) and Metroid (USA)
  ROMs (128 KB each; the same two the hub's Zelda 1 and Metroid pages take).
  Hyrule's 17 item spots (the dungeons' items, the Wood and White Sword caves,
  the Letter cave, the Armos and coast items) and Zebes' 38 power-up spots are
  one pool: any spot can hold either game's item. Samus starts with Maru Mari.
  Keys, maps, compasses, the triforces, the heart containers of the bosses and
  the shops stay where they are. The goal is Ganon **and** Mother Brain.
- **The logic** (`js/gen.js`): Hyrule's rules (`js/data.js` SPOTS: a sword,
  the bow, raft, ladder, recorder, the eight triforces for level 9) and the
  hub's Metroid rules (`../metroid/js/logic.js`), with the two worlds joined:
  Zebes is open from the start (a portal cave two screens from Link's start),
  Hyrule from Zebes needs Maru Mari (to reach an elevator). An assumed fill
  places the way-openers first; the seed is proved: from the start, every spot
  is reached and both ends are open.
- **Portals** (`js/link.js`): Hyrule → Zebes by entering one of the four
  "take any road" caves (screens `$1D`, `$23`, `$49`, `$79`); Zebes → Hyrule
  from any elevator room with the ⇄ button (or the P key). Each world goes on
  where it was left; the first visit to Zebes starts at Samus's ship.
- **Cross-game items**: a Metroid item in Hyrule sits in the ROM as five
  rupees, a Hyrule item on Zebes as a missile pack. The hub sees the pickup
  (Hyrule: the world flags `$067F..`, bit `$10`; Zebes: the taken-item list
  at `$6886..`) and hands the real item over the next time the other world is
  played: Link's inventory (`$0657..`), Samus's gear (`$6878`), tanks (`$6877`)
  or missiles (`$6879`/`$687A`). A toast says what was found and what arrived.
- **Tracker**: Link's and Samus's items (both games read, the one playing and
  the one waiting), every spot of both worlds ticked as it's taken and coloured
  by the seed's logic, the portals, what's waiting for whom, and the goal.
  Reveal shows every spot's item and the spoiler.
- **Saves**: both games' states are kept (every 20 s, at every portal, and
  when the app goes to the background; a frozen game isn't saved), so Continue
  picks up both worlds. The Download buttons give the two ROMs for any
  emulator, but the portals and the hand-over are the hub's.

## How the ROMs are changed

- Zelda: a dungeon room's item is table 4 (low 5 bits) of its grid
  (`0x18710` levels 1–6, `0x18A10` levels 7–9, +`0x200` + room); a cave's
  middle ware at `0x18610` + (destination − `$10`) × 3 + 1 (low 6 bits); the
  Armos item at `0x10D05`, the coast item at `0x1789A`.
- Metroid: as the hub's Metroid randomizer (`../metroid/`): each spot's type
  byte in the area's item table, the battery bit, the Maru Mari start stub.

## Not here (yet)

- The maps (Hyrule's overworld and Zebes' areas with the spots pinned).
- Shuffling the shops, the keys, the heart containers; a second-quest Hyrule.

## Files

- `js/data.js` — Hyrule's spots, item codes, what each item gives Link, the
  portals' screens, RAM. `js/gen.js` — the generator. `js/link.js` — the two
  games in one player, portals, pickups and hand-over, saved states.
  `js/tracker.js`, `js/seed.js`, `js/app.js`, `js/store.js`.
- `../z1r/emu/player.js` gained `newCore()` / `attach()`: a second core in the
  same player, swapped in a moment.
