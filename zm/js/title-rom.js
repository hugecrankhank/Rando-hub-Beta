/*
 * title-rom.js — the combined title, baked into both ROMs (so it shows in any
 * emulator, not just the hub):
 *
 *   Zelda's title gets "METROID" carved under the box, among the rocks: the
 *   Metroid logo's tiles (from your Metroid ROM, recoloured to the rocks'
 *   grays: the title's palette grid leaves no blue square there), in the 42
 *   tile slots Zelda's font block leaves empty ($1310..$1600, zeros in the
 *   ROM); PUSH START BUTTON moves to the top; the waterfall starts a row lower.
 *   Metroid's title gets "THE LEGEND OF ZELDA" in gold above its logo: Zelda's
 *   logo tiles (from your Zelda ROM) in the title's free slots $1900.., loaded
 *   by the title's own graphics entry, which now points at a new PRG bank (the
 *   ROM grows to 256 KB: banks 8..14 empty but the tiles, 15 the fixed bank;
 *   the bank switch is told not to keep the old bank's bit 3), and drawn by the
 *   title's PPU strings, rewritten tighter (the attribute fills and the blank
 *   padding) to make room for the five rows.
 *
 *   ZMTitleRom.bakeZelda(zelda, metroid)   → the Zelda ROM with Metroid's logo (metroid: a vanilla Metroid ROM)
 *   ZMTitleRom.bakeMetroid(metroid, zelda) → the 256 KB Metroid ROM with Zelda's logo (zelda: a vanilla Zelda ROM)
 */
(function () {
  'use strict';

  // a tile's pixels through a colour map (NES 2-bit planar)
  function recolour(t, map) {
    const out = new Uint8Array(16);
    for (let y = 0; y < 8; y++) {
      let lo = 0, hi = 0;
      for (let x = 0; x < 8; x++) {
        const v = map[((t[y] >> (7 - x)) & 1) | (((t[y + 8] >> (7 - x)) & 1) << 1)];
        lo |= (v & 1) << (7 - x); hi |= ((v >> 1) & 1) << (7 - x);
      }
      out[y] = lo; out[y + 8] = hi;
    }
    return out;
  }
  const key = (t) => Array.from(t).join(',');

  // ── Zelda: METROID under the box ───────────────────────────────────────────
  const M_CHR = 0x187F0;           // Metroid's title tiles: tile i at M_CHR + i * 16
  const M_LOGO = [                 // Metroid's title, rows 8..12, columns 3..28 (0xFF = nothing there)
    '40 5d 56 5d 43 40 5d 43 40 5d 5d 43 40 5d 5d 63 62 5d 5d 63 40 43 40 5d 5d 63',
    '44 50 50 50 47 44 57 58 74 75 76 77 44 57 69 47 44 57 69 47 44 47 44 68 69 47',
    '44 41 7e 49 47 44 59 5a 78 79 7a 7b 44 59 6d 70 44 73 72 47 44 47 44 73 72 47',
    '44 42 7f 4a 47 44 5b 5c ff 44 47 ff 44 5b 6f 71 44 45 46 47 44 47 44 45 46 47',
    '44 47 ff 44 47 44 5f 60 ff 44 47 ff 44 7d 7c 47 44 6a 6b 47 44 47 44 6a 6b 47'].map((r) => r.split(' ').map((x) => parseInt(x, 16)));
  const Z_FONT = 0x878F, Z_FIRST = 0x31, Z_LAST = 0x60;   // Zelda's font block (tiles 0..$6F → $1000); $31..$60 are empty
  const Z_TABLE = 0x1A904;                                  // the title screen's PPU strings: row r at Z_TABLE + r * 35 (+3 = the tiles)
  const zrow = (r) => Z_TABLE + r * 35 + 3;
  const GRAYS = [0, 3, 2, 1];      // highlight → light gray, face → dark gray, edge → black (palette 0: pink, black, dark gray, light gray)

  function bakeZelda(zelda, metroid) {
    const out = zelda.slice(0), slots = new Map();
    let next = Z_FIRST;
    const slot = (i) => {
      const t = recolour(metroid.subarray(M_CHR + i * 16, M_CHR + i * 16 + 16), GRAYS), k = key(t);
      if (!slots.has(k)) { if (next > Z_LAST) throw new Error('no tile slot left'); out.set(t, Z_FONT + next * 16); slots.set(k, next++); }
      return slots.get(k);
    };
    out.fill(0x24, zrow(20) + 8, zrow(20) + 25);                                          // PUSH START BUTTON leaves row 20…
    out.set([0x19, 0x1E, 0x1C, 0x11, 0x24, 0x1C, 0x1D, 0x0A, 0x1B, 0x1D, 0x24, 0x0B, 0x1E, 0x1D, 0x1D, 0x18, 0x17], zrow(2) + 8);   // …for row 2
    out.set([0xDA, 0xDC, 0xDD, 0xDB], zrow(23) + 10);                                   // the waterfall's top row becomes rock
    M_LOGO.forEach((tiles, k) => tiles.forEach((i, c) => { if (i !== 0xFF) out[zrow(19 + k) + 3 + c] = slot(i); }));   // rows 19..23, columns 3..28
    const attr = Z_TABLE + 31 * 35 + 3 + 8;                                              // attribute row 5 (tile rows 20..23)
    out[attr + 2] = 0x00; out[attr + 3] = 0x00;                                          // columns 8..15: palette 0 (was the waterfall's)
    return out;
  }

  // ── Metroid: THE LEGEND OF ZELDA above the logo ────────────────────────────
  const Z_CHR = 0x4FC4;            // Zelda's title tiles ($70..$F1): tile i at Z_CHR + i * 16
  const Z_ROWS = [[7, 8, 21], [8, 7, 25], [9, 7, 24], [10, 7, 25], [11, 6, 25]];   // Zelda's title rows and columns → Metroid rows 2..6
  const GOLD = [0, 1, 2, 3], GOLD_TEXT = [0, 1, 1, 3], GOLD_TM = [0, 1, 1, 1];      // palette 0: black, gold, orange, dark brown
  const M_TABLE0 = 0x304, M_TABLE1 = 0x72E;   // the title + intro PPU strings (bank 0), terminator included
  const M_GFX = 0x1C783;                       // graphics entry 21 (the title logo): [bank][src][dest][len]
  const M_SWITCH = 0x1C010 + 0x4F5;            // the bank switch's AND #$18 (the old register's bits kept)
  const BANK = 8, B8 = 0x10 + BANK * 0x4000, TITLE_SRC = 0x18BF0;

  function bakeMetroid(metroid, zelda) {
    if (metroid.length !== 0x20010 || metroid[4] !== 8) throw new Error('not a 128 KB Metroid ROM');
    const m = metroid.slice(0), z = zelda;
    if (m[M_SWITCH - 1] !== 0x29 || m[M_SWITCH] !== 0x18) throw new Error('unexpected bank switch');
    m[M_SWITCH] = 0x10;
    // the tiles for bank 8: the title's own 0x500 bytes, then Zelda's logo
    const extra = new Uint8Array(0x500 + 0x470); extra.set(m.subarray(TITLE_SRC, TITLE_SRC + 0x500));
    const slots = new Map(); let n = 0;
    const slot = (i) => {
      const map = i === 0x30 ? GOLD_TM : (i >= 0x71 && i <= 0x7B ? GOLD_TEXT : GOLD);
      const t = recolour(z.subarray(Z_CHR + i * 16, Z_CHR + i * 16 + 16), map), k = key(t);
      if (!slots.has(k)) { if (0x90 + n > 0xFE) throw new Error('no tile slot left'); extra.set(t, 0x500 + n * 16); slots.set(k, 0x90 + n++); }
      return slots.get(k);
    };
    const rows = Z_ROWS.map(([r, c0, c1]) => [r - 5, c0, Array.from(z.subarray(zrow(r) + c0, zrow(r) + c1)).map((i) => i === 0x24 ? 0xFF : slot(i))]);
    const len = 0x500 + n * 16;
    const e = m.subarray(M_GFX, M_GFX + 7);
    if (key(e) !== key([6, 0xE0, 0x8B, 0x00, 0x14, 0x00, 0x05])) throw new Error('unexpected graphics entry');
    m.set([BANK, 0x00, 0x80, 0x00, 0x14, len & 0xFF, len >> 8], M_GFX);
    // the PPU strings, rebuilt
    const rec = (addr, data) => [addr >> 8, addr & 0xFF, data.length, ...data];
    const fill = (addr, count, v) => [addr >> 8, addr & 0xFF, 0x40 | count, v];
    const raw = (o, len2) => Array.from(m.subarray(o, o + len2));
    const marks = [[5, 0x8C], [11, 0x8D], [14, 0x8E], [21, 0x8C], [27, 0x8D], [30, 0x8E]];
    let t = [];
    t.push(...fill(0x23C0, 16, 0), ...fill(0x23D0, 16, 0xFF), ...rec(0x23E0, [0xFF, 0xFF, 0xBF, 0xAF, 0xFF, 0xFF, 0xFF, 0xFF]), ...fill(0x23E8, 24, 0));
    marks.forEach(([c, v]) => t.push(...rec(0x22E0 + c, [v])));
    for (let k = 0; k < 6; k++) t.push(...raw(0x36D + k * 35, 35));                       // the ground
    for (let k = 0; k < 7; k++) t.push(...raw(0x443 + (k ? k * 29 + 2 : 0), k ? 29 : 31)); // METROID
    t.push(...rec(0x2228, raw(0x514, 17)), ...rec(0x2269, raw(0x52B, 15)));                 // PUSH START BUTTON, © 1986 NINTENDO
    rows.forEach(([r, c0, tiles]) => t.push(...rec(0x2000 + r * 32 + c0, tiles)));          // THE LEGEND OF ZELDA
    t.push(...fill(0x27C0, 8, 0), ...fill(0x27C8, 24, 0xFF), ...fill(0x27E0, 8, 0xFF), ...fill(0x27E8, 24, 0));
    marks.forEach(([c, v]) => t.push(...rec(0x26E0 + c, [v])));
    for (let k = 0; k < 6; k++) t.push(...raw(0x5A6 + k * 35, 35));                       // the intro's ground
    t.push(...raw(0x678, 0x718 - 0x678), ...rec(0x2677, raw(0x729, 4)), 0);                 // the emergency order, M510
    if (t.length > M_TABLE1 - M_TABLE0) throw new Error('title strings too long');
    m.fill(0xFF, M_TABLE0, M_TABLE1); m.set(t, M_TABLE0);
    // 256 KB: banks 8..14 (bank 8 = the tiles), 15 = the fixed bank
    const out = new Uint8Array(0x10 + 16 * 0x4000);
    out.set(m); out[4] = 16; out.fill(0xFF, 0x20010); out.set(extra, B8); out.set(m.subarray(0x1C010, 0x20010), 0x10 + 15 * 0x4000);
    return out;
  }

  window.ZMTitleRom = { bakeZelda, bakeMetroid };
})();
