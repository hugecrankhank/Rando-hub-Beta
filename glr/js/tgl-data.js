/*
 * tgl-data.js — what GLR knows about The Guardian Legend (USA) ROM.
 *
 * Everything here was worked out from the ROM itself (mapper 2 / UNROM,
 * 8 x 16 KB PRG banks, bank 7 fixed at $C000). Used by the randomizer, the
 * tracker and the map, in the browser and in Node (tools/).
 *
 * The labyrinth ("Naju") is a 24 x 24 grid of screens. Bank 5 $8A6E holds
 * one variable-length record per screen, row by row:
 *
 *   byte 0  bits 0-3  record length - 1          ($80 alone = no screen)
 *           bit 4     has a block overlay (pointer at the end of the record)
 *           bits 5-6  object: 0 none, 1 item ($20), 2 mini-boss ($40), 3 pyramid maze ($60)
 *           bit 7     "inner" room: corridor gate, Blue Lander, message or shop
 *   byte 1  bits 4-7  exits: up $80, left $40, right $20, down $10
 *           bits 0-2  key symbol that opens the door into this room (inner rooms)
 *   byte 2  normal rooms: area (0-10), +$10 on mini-boss rooms
 *           inner rooms: $80 | corridor number, or 1 Blue Lander, 3 message,
 *           2 shop (three wares), 6 shop (one ware)
 *   byte 3  item / mini-boss flag index (in the $04A0 bit array), message number
 *
 * Item kinds (bank 5 $A377, indexed by flag): 0-10 sub-weapons, 11 Enemy
 * Eraser, 12 Energy Tank, 13 Blue Lander, 14 Attack, 15 Defense, 16 Shield,
 * 17 Red Lander (the pick-up routine is bank 2 $86BC).
 *
 * Corridor 1-10 rewards: bank 7 $F6DA[corridor] = key 1-7 (0 = none).
 * Corridor 21 opens once corridors 1-10 are all cleared.
 */
(function (root) {
  'use strict';

  const HEADER = 16;
  const prg = (bank, addr) => HEADER + bank * 0x4000 + (addr - (bank === 7 ? 0xC000 : 0x8000));

  const AT = {
    rooms: prg(5, 0x8A6E),
    roomsEnd: prg(5, 0x91EA),
    itemKind: prg(5, 0xA377),    // 68 bytes, by flag index
    keyTable: prg(7, 0xF6DA),    // 11 bytes, by corridor 0-10
    bonus: prg(3, 0x817A),       // 73 x (threshold, kind): "YOU GOT ITEM" after corridors
    bonusCount: 73,
    menuToggle: prg(0, 0x844C),  // EOR #$01 on the title menu cursor ($2F)
    menuText: HEADER + 0x087D,   // "PASSWORD CONTINUE", 17 chars
  };

  // RAM (2 KB, $0000-$07FF)
  const RAM = {
    roomX: 0x52, roomY: 0x53,
    hp: 0x48, hpMax: 0x47,
    attack: 0x4A, defense: 0x4B, shield: 0x6B, redLanders: 0x46,
    corridor: 0x51,              // corridor being played (0 = labyrinth)
    mode: 0x30,
    flags: 0x04A0,               // 9 bytes: item / mini-boss flags (by index)
    cleared: 0x04A9,             // corridors cleared, bit (n-1)
    weapons: 0x04AC,             // 3 bytes, 2 bits per sub-weapon level
    eraser: 0x04AF,              // Enemy Eraser ammo; $04AE bit 6 = have it
    keys: 0x04B0,                // bit (k-1) = key k
    chips: 0x0173,               // 3 BCD-ish digit bytes (see tracker)
    score: 0x0170,
  };

  const WEAPONS = ['Multi-Bullet', 'Back Fire', 'Wave Attack', 'Bullet Shield', 'Grenade', 'Fireball',
    'Area Blaster', 'Repeller', 'Hyper Laser', 'Saber Laser', 'Cutter Laser'];
  const KINDS = WEAPONS.concat(['Enemy Eraser', 'Energy Tank', 'Blue Lander', 'Attack Up', 'Defense Up',
    'Shield', 'Red Lander']);
  const SHORT = ['MB', 'BF', 'WA', 'BS', 'GR', 'FB', 'AB', 'RP', 'HL', 'SL', 'CL', 'EE', 'ET', 'BL', 'AT', 'DF', 'SH', 'RL'];
  const KEYS = ['Crescent', 'Hook', 'Wave', 'Square', 'Cross', 'Triangle', 'Bar'];
  const isWeapon = (k) => k >= 0 && k <= 10;

  // Vanilla corridor -> key (for the spoiler and the tracker's defaults).
  const VANILLA_KEYS = [0, 1, 2, 3, 4, 0, 5, 0, 6, 7, 0];

  // How each primary corridor's hatch is opened (the game's own hints).
  const UNLOCK = {
    1: 'Shoot the hatch for a few seconds', 2: 'Touch the four corner panels', 3: 'Wait in the room',
    4: 'Leave and re-enter a shop room you bought from', 5: 'Shoot the "Corridor 5" sign',
    6: 'Use a sub-weapon in the room', 7: 'Enter and leave the room several times',
    8: 'Set the weapon to NO USE and fire', 9: 'Stand on the hatch', 10: 'Keep firing in the room',
  };

  function parseRooms(rom) {
    const out = [];
    let o = AT.rooms;
    for (let y = 0; y < 24; y++) {
      for (let x = 0; x < 24; x++) {
        const len = (rom[o] & 0x0F) + 1;
        const b = rom.subarray(o, o + len);
        const r = { x, y, off: o, len, b0: b[0], empty: b[0] === 0x80 };
        o += len;
        if (!r.empty) {
          r.exits = { U: !!(b[1] & 0x80), L: !!(b[1] & 0x40), R: !!(b[1] & 0x20), D: !!(b[1] & 0x10) };
          r.sym = b[1] & 7;
          r.inner = !!(b[0] & 0x80);
          const obj = (b[0] >> 5) & 3;
          if (r.inner) {
            r.key = b[1] & 7;
            if (b[2] & 0x80) { r.type = 'corridor'; r.corridor = b[2] & 0x7F; }
            else if (b[2] === 1) r.type = 'save';
            else if (b[2] === 3) { r.type = 'message'; r.message = b[3]; }
            else if (b[2] === 2 || b[2] === 6) { r.type = 'shop'; r.shop = b[3]; r.wares = b[2] === 2 ? 3 : 1; }
            else r.type = 'inner';
          } else {
            r.area = b[2] & 0x0F;
            r.type = obj === 1 ? 'item' : obj === 2 ? 'boss' : obj === 3 ? 'maze' : 'room';
            if (obj === 1 || obj === 2) r.flag = b[3];
          }
        }
        out.push(r);
      }
    }
    if (o !== AT.roomsEnd) throw new Error('room table did not parse (' + o.toString(16) + ')');
    // Inner rooms have no area of their own: take it from a connected neighbour.
    const at = (x, y) => (x >= 0 && y >= 0 && x < 24 && y < 24 ? out[y * 24 + x] : null);
    for (let pass = 0; pass < 4; pass++) {
      for (const r of out) {
        if (r.empty || r.area != null) continue;
        for (const [d, dx, dy] of [['U', 0, -1], ['L', -1, 0], ['R', 1, 0], ['D', 0, 1]]) {
          const n = at(r.x + dx, r.y + dy);
          if (r.exits[d] && n && !n.empty && n.area != null) { r.area = n.area; break; }
        }
      }
    }
    return out;
  }

  // Edges between screens: both sides must have the exit.
  const DIRS = [['U', 0, -1, 'D'], ['L', -1, 0, 'R'], ['R', 1, 0, 'L'], ['D', 0, 1, 'U']];
  function edges(rooms) {
    const at = (x, y) => (x >= 0 && y >= 0 && x < 24 && y < 24 ? rooms[y * 24 + x] : null);
    const E = new Map();
    for (const r of rooms) {
      if (r.empty) continue;
      const list = [];
      for (const [d, dx, dy, back] of DIRS) {
        const n = at(r.x + dx, r.y + dy);
        if (!n || n.empty || !r.exits[d] || !n.exits[back]) continue;
        // Doors only exist between an inner room and its neighbour. The symbol
        // on a door is the *other* room's (byte 1 bits 0-2): going into an
        // inner room needs its key, and leaving one into a normal room needs
        // that room's key (bank 5 $82E7).
        let key = 0;
        if (n.inner) key = n.key;
        else if (r.inner) key = n.sym;
        list.push({ to: n, dir: d, key });
      }
      E.set(r, list);
    }
    return E;
  }
  function reachable(rooms, E, keys, start) {
    const s = start || rooms[12 * 24 + 11];
    const seen = new Set([s]), st = [s];
    while (st.length) {
      const c = st.pop();
      for (const e of E.get(c) || []) {
        if (seen.has(e.to)) continue;
        if (e.key && !keys.has(e.key)) continue;
        seen.add(e.to); st.push(e.to);
      }
    }
    return seen;
  }

  // CRC32 of the PRG (no header): identifies the base ROM.
  function crc32(bytes, from, to) {
    let c, t = crc32.t;
    if (!t) { t = crc32.t = new Uint32Array(256); for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } }
    c = 0xFFFFFFFF;
    for (let i = from || 0; i < (to == null ? bytes.length : to); i++) c = t[(c ^ bytes[i]) & 255] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  const BASE_PRG_CRC = 0xFA43146B;  // The Guardian Legend (USA), PRG only

  function checkBase(rom) {
    if (!rom || rom.length < HEADER + 0x20000) return 'too small for The Guardian Legend';
    if (!(rom[0] === 0x4E && rom[1] === 0x45 && rom[2] === 0x53 && rom[3] === 0x1A)) return 'not an .nes (iNES) file';
    const mapper = (rom[6] >> 4) | (rom[7] & 0xF0);
    if (mapper !== 2 || rom[4] !== 8) return 'not The Guardian Legend (wrong mapper/size)';
    const crc = crc32(rom, HEADER, HEADER + 0x20000);
    if (crc !== BASE_PRG_CRC) return 'unknown version (PRG CRC ' + crc.toString(16).padStart(8, '0') + '); use The Guardian Legend (USA)';
    return null;
  }

  const api = { HEADER, prg, AT, RAM, WEAPONS, KINDS, SHORT, KEYS, VANILLA_KEYS, UNLOCK, isWeapon,
    parseRooms, edges, reachable, crc32, checkBase, BASE_PRG_CRC };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TGL = api;
})(typeof self !== 'undefined' ? self : this);
