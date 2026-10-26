# The Guardian Legend (USA) — ROM and RAM notes

Worked out for GLR from the ROM (PRG CRC32 `FA43146B`, MD5 of the full .nes
`ab33dca3502b7632763cf043882fe2e9`). Mapper 2 (UNROM): 8 x 16 KB PRG banks,
bank 7 fixed at `$C000`, CHR-RAM. Bank switching goes through the bus-conflict
table at `$FFF2`; the current bank number lives in `$04`. The fixed bank starts
with a jump table at `$C000-$C11F` used by every other bank.

## Labyrinth room table (bank 5 `$8A6E`-`$91E9`)

24 x 24 screens, row by row, one variable-length record each.

| Byte | Bits | Meaning |
|---|---|---|
| 0 | 0-3 | record length - 1 (`$80` alone = no screen) |
| 0 | 4 | block overlay: pointer to a pattern at the end of the record |
| 0 | 5-6 | object: 0 none, 1 item (`$20`), 2 mini-boss (`$40`), 3 pyramid maze (`$60`) |
| 0 | 7 | inner room (corridor gate, Blue Lander, message, shop) |
| 1 | 4-7 | exits: up `$80`, left `$40`, right `$20`, down `$10` |
| 1 | 0-2 | key symbol for doors that lead **into** this room from an inner room / into this inner room |
| 2 | | normal rooms: area 0-10 (+`$10` on mini-boss rooms) |
| 2 | | inner rooms: `$80|n` corridor *n*; 1 Blue Lander; 2 shop (3 wares); 3 message; 6 shop (1 ware) |
| 3 | | item / mini-boss flag index (`$04A0` bit array), message number, shop number |

Exits always agree on both sides. Doors (blue pyramids, metatile `$08`) only
exist between an inner room and its neighbour; bank 5 `$82E7` places them at
metatiles `$37` (up), `$72` (left), `$7D` (right), `$A7` (down) and takes the
door's key symbol from the **other** room's byte 1. So entering an inner room
needs the inner room's key, and leaving it into a normal room needs the normal
room's key.

Keys (`$04B0` bit k-1): 1 crescent, 2 hook, 3 wave, 4 square, 5 cross,
6 triangle, 7 bar.

## Tables GLR changes

| Where | What |
|---|---|
| bank 5 `$A377` (68 bytes) | item kind by flag index; read at `$814F` into `$55` |
| bank 7 `$F6DA` (11 bytes) | key given by primary corridor 0-10 (read at `$F4A7`, set at `$F547`) |
| bank 3 `$817A` (73 x 2) | "YOU GOT ITEM" bonus list: score threshold, item kind |
| bank 0 `$844C` | title menu `EOR #$01` on `$2F` (GLR: `AND #$00`) |
| file `$088D` (17 chars) | "PASSWORD CONTINUE" text |

Item kinds (pick-up routine bank 2 `$86BC`): 0-10 sub-weapons (Multi-Bullet,
Back Fire, Wave Attack, Bullet Shield, Grenade, Fireball, Area Blaster,
Repeller, Hyper Laser, Saber Laser, Cutter Laser; level +1 in `$04AC-$04AE`,
2 bits each, chips when maxed), 11 Enemy Eraser (`$04AE` bit 6, +20 to
`$04AF`), 12 Energy Tank (refill), 13 Blue Lander (max health +8), 14 Attack
(`$4A`+1), 15 Defense (`$4B`+1), 16 Shield (`$6B`+1, max 5, sets fire rate
`$39`), 17 Red Lander (`$46`+1, chip max from table bank 2 `$87D4`).

Other tables: bank 7 `$EF40` item at each corridor hatch (by corridor);
bank 5 `$A682` mini-boss by flag; bank 2 `$87D4` chip maximums.

## Room building

Entering a screen runs (fixed bank) `$802D` (record pointers for the screen
and its four neighbours into `$E0-$E9`, from `$52/$53` and the scroll
direction `$A4`), then `$EEE0` for normal rooms or `$EE1D` for inner rooms:
`$8121` (object type `$5D`, flag `$5E`, kind `$55`), `$8000` (area graphics),
`$8155` (layout into `$0740`, 16 x 12 metatiles), `$A3BB` (item spot),
`$8354` (collision nibbles into `$0400`). Metatiles: `$00` void, `$01-$05`
yellow pyramids, `$06` item spot, `$08` blue pyramid (door), `$09` red
pyramid, `$0A` empty socket, `$0D` sign / message panel, `$20-$9F` floor,
`$A0+` wall.

## Corridors

`$51` = corridor number while flying one; `$30` bit 6 set in corridors.
Clearing corridor *n* sets `$04A9` bit *n*-1 (`$EFBA`). Corridor 21 checks
`$04A9 & ($04AA|$FC) == $FF`. Hatch openers (from the in-game hints): 1 shoot
the hatch, 2 touch the four corner panels, 3 wait, 4 leave and re-enter a shop
you bought from, 5 shoot the sign, 6 use a sub-weapon, 7 enter and leave
several times, 8 fire with NO USE selected, 9 stand on the hatch, 10 keep
firing.

## RAM

| Address | |
|---|---|
| `$2F` | title menu cursor (0 new game, 1 password) |
| `$30` | mode bits (`$40` corridor) |
| `$46` | Red Landers |
| `$47` / `$48` | max / current health |
| `$4A` / `$4B` | attack / defense |
| `$4C-$4F` | chips, chip max (16-bit) |
| `$50` / `$51` | area / corridor or room class |
| `$52` / `$53` | screen X / Y (also `$7C` / `$7D`) |
| `$6B` | shield |
| `$0170-$0175` | score digits (x10) |
| `$0400-$045F` | collision nibbles of the current screen |
| `$0411-$0430` | password characters on the password screen |
| `$0439-$0450` | decoded password (22 state bytes, checksum, key) |
| `$04A0-$04A8` | item / mini-boss flags (72) |
| `$04A9-$04AB` | corridors cleared |
| `$04AC-$04AE` | sub-weapon levels; `$04AE` bit 6 Enemy Eraser |
| `$04AF` | Enemy Eraser ammo |
| `$04B0` | keys |
| `$04B1` | mini-boss defeated bits |
| `$0518` / `$0530` | player Y / X |
| `$0740-$07FF` | metatiles of the current screen (during building) |

## Password (for reference)

32 characters of 6 bits = 24 bytes. Byte 23 is a key; bytes 0-22 are XORed
with `key + $1D - i`. Byte 22 is a checksum: bytes 0-21 plus the key summed
with `ADC` and a single `CLC` (carries chain into the next add). The 22 state
bytes are `$04A0-$04B0` plus packed `$46`, `$47`, `$6B`, `$52`/`$4A`,
`$53`/`$4B`, score and chips (bank 3 `$83AE` / `$8473`). "TGL" with the rest
blank is the secret mode. GLR switches the password option off.
