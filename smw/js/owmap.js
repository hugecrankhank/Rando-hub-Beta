/*
 * owmap.js — Super Mario World's overworld, drawn from the ROM being played
 * (nothing of the game is shipped): the same steps the game takes when it
 * loads the overworld (SMWDisX, bank 04 / bank 00, US version).
 *
 *   SMWOverworld.check(rom)            → '' or why this ROM can't be drawn
 *   const ow = SMWOverworld.build(rom, { events, all, special })
 *     events:  the event flags ($1F02.., 15 bytes) or null (a new game)
 *     all:     every event done (the whole map, every path)
 *     special: the Special Zone beaten ($1EEA bit 7): its other colours
 *   ow.render(world)                   → { w, h, data } RGBA, world 0..6 (WORLDS)
 *   ow.levels[translevel]              → { world, x, y } the level's tile on it
 *   SMWOverworld.mario(ram)            → { world, x, y } Mario on the overworld
 *
 * Layers:
 *   layer 2 — the land: two RLE streams (tile numbers $04:A533, properties
 *     $04:C02B) into a 64 × 128 tilemap of 8 × 8 tiles (VRAM order: 32 × 32
 *     blocks, main map = blocks 0–3, submaps = 4–7). Each event done pastes
 *     its 6 × 6 (or 2 × 2) pieces: the paths that open ($04:E359 ranges,
 *     $04:DD8D source/destination pairs, tile numbers $0C:8000, properties
 *     RLE at $0C:8D00).
 *   layer 1 — the paths and levels: 16 × 16 tiles, $0C:F7DF (8 screens of
 *     16 × 16), each tile four 8 × 8 tiles at $05:D000; events reveal level
 *     tiles ($04:D85D + the swap table $04:DA1D → $04:DA33), crush castles
 *     ($04:E5D6…) and set more tiles ($04:E8E4…).
 *   graphics — GFX files $1C, $1D, $08, $1E (LC_LZ2, 3bpp → 4bpp as the game
 *     uploads them), tiles $75–$7F the animated ones (GFX $14).
 *   colours — $00:B3D8 (one set per map) + the standard rows.
 */
(function () {
  'use strict';
  const lo = (a) => ((a >> 16) & 0x7F) * 0x8000 + (a & 0x7FFF);
  const w16 = (r, a) => r[lo(a)] | r[lo(a) + 1] << 8;

  // ── a ROM the drawing understands: the original overworld code ─────────
  function check(rom) {
    if (!rom || rom.length < 0x80000) return 'no ROM';
    if (rom.length % 1024 === 512) rom = rom.subarray(512);
    const at = (a, hex) => hex.split(' ').every((h, i) => rom[lo(a) + i] === parseInt(h, 16));
    if (!at(0x04DC71, 'a9 33 a5') || !at(0x04DC78, 'a9 04') || !at(0x04DC8C, 'a9 2b c0')) return 'its overworld isn’t stored the original way (a Lunar Magic hack?)';
    if (!at(0x04DC57, 'a9 ff 07 a2 df f7 a0 00 c8 54 7e 0c')) return 'its overworld isn’t stored the original way (a Lunar Magic hack?)';
    return '';
  }

  // ── LC_LZ2, the game's graphics compression ($00:B8DE, US: big-endian copies)
  function lz2(rom, off) {
    const out = [];
    for (let guard = 0; guard < 20000; guard++) {
      const b = rom[off++];
      if (b === 0xFF || b === undefined) break;
      let cmd, len;
      if ((b & 0xE0) === 0xE0) { cmd = (b << 3) & 0xE0; len = (((b & 3) << 8) | rom[off++]) + 1; }
      else { cmd = b & 0xE0; len = (b & 0x1F) + 1; }
      if (cmd === 0x00) { for (let i = 0; i < len; i++) out.push(rom[off++]); }
      else if (cmd === 0x20) { const v = rom[off++]; for (let i = 0; i < len; i++) out.push(v); }
      else if (cmd === 0x40) { const a = rom[off++], c = rom[off++]; for (let i = 0; i < len; i++) out.push(i & 1 ? c : a); }
      else if (cmd === 0x60) { let v = rom[off++]; for (let i = 0; i < len; i++) out.push(v++ & 0xFF); }
      else { let src = rom[off] << 8 | rom[off + 1]; off += 2; for (let i = 0; i < len; i++) out.push(out[src++] || 0); }
    }
    return Uint8Array.from(out);
  }
  function gfxFile(rom, n) {
    const a = rom[lo(0x00B992) + n] | rom[lo(0x00B9C4) + n] << 8 | rom[lo(0x00B9F6) + n] << 16;
    return lz2(rom, lo(a));
  }
  // 3bpp tiles (24 bytes) → pixel indices; fourth plane = "or" of the other three or nothing
  function tiles3(buf, first, count, plane3) {
    const px = new Uint8Array(count * 64);
    for (let t = 0; t < count; t++) {
      const o = (first + t) * 24;
      for (let r = 0; r < 8; r++) {
        const p0 = buf[o + 2 * r] || 0, p1 = buf[o + 2 * r + 1] || 0, p2 = buf[o + 16 + r] || 0, p3 = plane3 ? (p0 | p1 | p2) : 0;
        for (let c = 0; c < 8; c++) {
          const m = 0x80 >> c;
          px[t * 64 + r * 8 + c] = (p0 & m ? 1 : 0) | (p1 & m ? 2 : 0) | (p2 & m ? 4 : 0) | (p3 & m ? 8 : 0);
        }
      }
    }
    return px;
  }
  // the 512 BG tiles of the overworld (VRAM $0000–$3FFF)
  function chars(rom) {
    const px = new Uint8Array(512 * 64);
    [[0x1C, false], [0x1D, false], [0x08, true], [0x1E, true]].forEach(([f, or], slot) => px.set(tiles3(gfxFile(rom, f), 0, 128, or), slot * 128 * 64));
    // the animated tiles $75–$7F: GFX $14, their first frame ($04:8000, $04:8006)
    const g14 = gfxFile(rom, 0x14);
    const src = [0xB480, 0xB498, 0xB4B0];
    for (let k = 0; k < 8; k++) src.push(w16(rom, 0x048006 + k * 0x10));
    src.forEach((a, i) => px.set(tiles3(g14, (a - 0xAD00) / 24, 1, false), (0x75 + i) * 64));
    return px;
  }

  // ── colours ($00:AD25) ──────────────────────────────────────────────────
  function bgr(v) { return [(v & 31) * 255 / 31 | 0, (v >> 5 & 31) * 255 / 31 | 0, (v >> 10 & 31) * 255 / 31 | 0]; }
  function palette(rom, tileset, special) {
    const cg = new Uint16Array(256);
    const load = (src, dst, cols, rows) => { for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) cg[dst / 2 + r * 16 + c] = w16(rom, src + (r * cols + c) * 2); };
    const idx = rom[lo(0x00AD1E) + (tileset & 15) - 1];
    load((special ? 0x00B732 : 0x00B3D8) + w16(rom, 0x00ABDF + idx * 2), 0x82, 7, 4);
    load(0x00B528, 0x52, 7, 6);
    load(0x00B57C, 0x102, 7, 7);
    load(0x00B5EC, 0x10, 8, 2);
    return Array.from(cg, bgr);
  }

  // ── layer 2: the land ($04:DC6A) and its events ($04:E453) ──────────────
  function rle2(rom, off, buf, start) {
    for (let x = start; x < 0x4000;) {
      const b = rom[off++];
      if (b & 0x80) { const v = rom[off++]; for (let n = (b & 0x7F) + 1; n--; x += 2) buf[x] = v; }
      else for (let n = b + 1; n--; x += 2) buf[x] = rom[off++];
    }
  }
  function eventProps(rom) {
    const out = new Uint8Array(0x10000);
    let off = lo(0x0C8D00), x = 0;
    for (let guard = 0; guard < 20000; guard++) {
      const b = rom[off++];
      if (b & 0x80) { const v = rom[off++]; for (let n = (b & 0x7F) + 1; n--;) out[x++] = v; }
      else for (let n = b + 1; n--;) out[x++] = rom[off++];
      if ((rom[off] | rom[off + 1] << 8) === 0xFFFF) break;
    }
    return out;
  }
  // a piece of event tiles into layer 2 ($04:E4A9): 6 × 6, or 2 × 2 from $0900
  function piece(rom, l2, ev, y, dest) {
    const n = y >= 0x900 ? 2 : 6;
    let d = dest;
    for (let row = 0; row < n; row++) {
      let x = d;
      for (let col = 0; col < n; col++) {
        l2[x & 0x3FFF] = rom[lo(0x0C8000) + y]; l2[(x + 1) & 0x3FFF] = ev[y]; y++; x += 2;
        if ((x & 0x3F) === 0) x = ((x - 1) & 0xFFC0) + 0x800;
      }
      const old = d; d += 0x40;
      if ((d & 0x7C0) === 0) d = (old & 0xF83F) + 0x1000;
    }
  }

  // ── the whole thing ─────────────────────────────────────────────────────
  // build(): both layers as the game has them now, the graphics; render(w):
  // one picture (0 = Dinosaur Land, 1–6 the submaps, each the window the game shows)
  function build(rom, o) {
    o = o || {};
    if (rom.length % 1024 === 512) rom = rom.subarray(512);
    const events = o.events, all = !!o.all;
    const done = (e) => all || !!(events && events[e >> 3] & (0x80 >> (e & 7)));
    // layer 2
    const l2 = new Uint8Array(0x4000);
    rle2(rom, lo(0x04A533), l2, 0); rle2(rom, lo(0x04C02B), l2, 1);
    const ev = eventProps(rom);
    for (let e = 0; e < 0x6F; e++) {
      if (!done(e)) continue;
      const a = w16(rom, 0x04E359 + e * 2), b = w16(rom, 0x04E35B + e * 2);
      for (let i = a; i < b && i < 0x400; i++) piece(rom, l2, ev, w16(rom, 0x04DD8D + i * 4), w16(rom, 0x04DD8F + i * 4));
    }
    // layer 1 ($04:DC09) and its level tiles, numbered in order: the translevels ($04:D7F2)
    const l1 = rom.slice(lo(0x0CF7DF), lo(0x0CF7DF) + 0x800);
    const levels = [];   // translevel → { world, x, y } (the tile's centre, in that world's picture)
    for (let y = 0, t = 1; y < 0x800; y++) if (l1[y] >= 0x56 && l1[y] < 0x81) levels[t++] = place(y >> 10, ((y >> 8) & 1) * 256 + (y & 15) * 16 + 8, ((y >> 9) & 1) * 256 + ((y >> 4) & 15) * 16 + 8);
    const SWAP_FROM = rom.slice(lo(0x04DA1D), lo(0x04DA1D) + 22), SWAP_TO = rom.slice(lo(0x04DA33), lo(0x04DA33) + 22);
    for (let e = 0; e < 0x6F; e++) {
      if (!done(e)) continue;
      // a level tile shown ($04:DA49)
      const y = w16(rom, 0x04D85D + e * 2) & 0x7FF;
      for (let x = 0x15; x >= 0; x--) if (l1[y] === SWAP_FROM[x]) { l1[y] = SWAP_TO[x]; if (x === 0x15) l1[(y + 1) & 0x7FF] = SWAP_TO[x]; break; }
      // a castle crushed ($04:E677)
      for (let x = 0x17; x >= 0; x--) {
        if (rom[lo(0x04E5D6) + x] !== e) continue;
        let p = w16(rom, 0x04E5B6 + x * 2);
        for (let k = 4; k >= 0; k--) if (l1[p & 0x7FF] === rom[lo(0x04E5A7) + k]) {
          if (k >= 3) { l1[p & 0x7FF] = rom[lo(0x04E5AC) + k]; p += 0x10; }
          l1[p & 0x7FF] = rom[lo(0x04E5B1) + k];
          break;
        }
        break;
      }
      // more tiles ($04:E9F1): layer 1, or a layer 2 piece
      for (let x = 0x2B; x >= 0; x--) {
        if (rom[lo(0x04E8E4) + x] !== e) continue;
        const v = w16(rom, 0x04E994 + x * 2), at = w16(rom, 0x04E93C + x * 2);
        if (rom[lo(0x04E910) + x] & 1) piece(rom, l2, ev, v, at); else l1[at & 0x7FF] = v & 0xFF;
      }
    }
    const px = chars(rom);

    function render(w) {
      const half = w ? 1 : 0, win = WORLDS[w], pal = palette(rom, win.tileset, !!o.special);
      const W = win.w, H = win.h, out = new Uint8ClampedArray(W * H * 4);
      const bg = pal[0];
      for (let i = 0; i < W * H; i++) { out[i * 4] = bg[0]; out[i * 4 + 1] = bg[1]; out[i * 4 + 2] = bg[2]; out[i * 4 + 3] = 255; }
      // a 8 × 8 tile at (X, Y) of the 512 × 512 half, into the window (it wraps, as the screen does)
      const put = (X, Y, word, prio) => {
        if (((word >> 13) & 1) !== prio) return;
        const t = word & 0x3FF; if (t >= 512) return;
        const bx = (X - win.x + 512) & 511, by = (Y - win.y + 512) & 511;
        if (bx >= W + 8 && bx < 504 || by >= H + 8 && by < 504) return;   // nowhere near the window
        const p = (word >> 10) & 7, hf = word & 0x4000, vf = word & 0x8000;
        for (let r = 0; r < 8; r++) {
          const yy = (by + r) & 511; if (yy >= H) continue;
          for (let c = 0; c < 8; c++) {
            const xx = (bx + c) & 511; if (xx >= W) continue;
            const v = px[t * 64 + (vf ? 7 - r : r) * 8 + (hf ? 7 - c : c)];
            if (!v) continue;
            const col = pal[p * 16 + v], q = (yy * W + xx) * 4;
            out[q] = col[0]; out[q + 1] = col[1]; out[q + 2] = col[2];
          }
        }
      };
      const layer2 = (prio) => {
        for (let blk = 0; blk < 4; blk++) for (let ty = 0; ty < 32; ty++) for (let tx = 0; tx < 32; tx++) {
          const i = ((half * 4 + blk) * 0x400 + ty * 32 + tx) * 2;
          put((blk & 1) * 256 + tx * 8, (blk >> 1) * 256 + ty * 8, l2[i] | l2[i + 1] << 8, prio);
        }
      };
      const layer1 = (prio) => {
        for (let s = 0; s < 4; s++) for (let ty = 0; ty < 16; ty++) for (let tx = 0; tx < 16; tx++) {
          const t = l1[(half * 4 + s) * 256 + ty * 16 + tx], d = lo(0x05D000) + t * 8;
          const X = (s & 1) * 256 + tx * 16, Y = (s >> 1) * 256 + ty * 16;
          put(X, Y, rom[d] | rom[d + 1] << 8, prio); put(X, Y + 8, rom[d + 2] | rom[d + 3] << 8, prio);
          put(X + 8, Y, rom[d + 4] | rom[d + 5] << 8, prio); put(X + 8, Y + 8, rom[d + 6] | rom[d + 7] << 8, prio);
        }
      };
      layer2(0); layer1(0); layer2(1); layer1(1);
      return { w: W, h: H, data: out };
    }
    return { levels, render };
  }

  // the pictures: Dinosaur Land whole, each submap the window the game shows of
  // it (its camera, $00:A06B / $00:A079, inside the overworld's border: screen
  // x 17–238, y 40–205, the layers one line down)
  const WORLDS = [{ name: 'Dinosaur Land', tileset: 0x11, x: 0, y: 0, w: 512, h: 512 }];
  [["Yoshi's Island", -17, -40], ['Vanilla Dome', -17, 0x80], ['Forest of Illusion', -17, 0x128], ['Valley of Bowser', 0xF0, -40], ['Special Zone', 0xF0, 0x80], ['Star World', 0xF0, 0x128]]
    .forEach(([name, cx, cy], i) => WORLDS.push({ name, tileset: 0x12 + i, x: (cx + 17 + 512) & 511, y: (cy + 41 + 512) & 511, w: 222, h: 166 }));
  // a point of a half (0 main, 1 submaps) → the world it shows in, and where
  function place(half, x, y) {
    if (!half) return { world: 0, x, y };
    for (let w = 1; w < WORLDS.length; w++) {
      const v = WORLDS[w], dx = (x - v.x + 512) & 511, dy = (y - v.y + 512) & 511;
      if (dx < v.w && dy < v.h) return { world: w, x: dx, y: dy };
    }
    return null;
  }
  // Mario on the overworld: $1F11 submap, $1F17 / $1F19 x / y (+ 4 per player)
  function mario(ram) {
    if (!ram || ram.length < 0x2000) return null;
    const p = (ram[0x0DD6] >> 2) & 1, sub = ram[0x1F11 + p], x = ram[0x1F17 + p * 4] | ram[0x1F18 + p * 4] << 8, y = ram[0x1F19 + p * 4] | ram[0x1F1A + p * 4] << 8;
    if (sub > 6) return null;
    if (!sub) return { world: 0, x: x & 511, y: y & 511 };
    const v = WORLDS[sub], dx = (x - v.x + 512) & 511, dy = (y - v.y + 512) & 511;
    return { world: sub, x: dx, y: dy };
  }

  window.SMWOverworld = { check, build, place, mario, WORLDS };
})();
