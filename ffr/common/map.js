/*
 * map.js — the world map for the Final Fantasy pages (ffr/ff1, ff4, ff5):
 * the game's own world maps drawn from the player's ROM, a pin on every
 * place, the party's dot, on the hub's ../../world-map.js viewer. The game's
 * game.js says what to draw and where (FFGame.map):
 *
 *   map: {
 *     worlds: [{ name, draw(rom) -> canvas | null }],   draw with FFMapGfx below
 *     places: [{ world, x, y, name, checks?: [[sectionId, area]] }],   map squares; checks: the tracker's list items in that area
 *     pos(mem) -> { world, x, y } | null,               the party, in map squares (null: not on a world map)
 *   }
 *
 * A place with checks is done when all of them are; one without is a
 * landmark (always gold). Inside a town or dungeon the dot stays, dimmed, at
 * the last world square. Nothing of the games is shipped: the pictures come
 * from the ROM being played (or, before that, nothing).
 */
(function () {
  'use strict';
  const CELL = 8;   // map square in picture pixels (half the game's 16)

  // ── drawing helpers ──────────────────────────────────────────────────────
  function interlace(data, word, layers, stride) {
    const step = word * stride, block = step * layers, n = Math.ceil(data.length / block) * block;
    const src = new Uint8Array(n); src.set(data);
    const out = new Uint8Array(n); let d = 0;
    for (let s = 0; s < n; s += block) for (let s1 = s; s1 - s < step; s1 += word) for (let s2 = s1; s2 - s < block; s2 += step) { for (let k = 0; k < word; k++) out[d++] = src[s2 + k]; }
    return out.subarray(0, data.length);
  }
  function bgr555(r, at, n) {
    const p = new Uint32Array(n);
    for (let i = 0; i < n; i++) { const v = r[at + i * 2] | r[at + i * 2 + 1] << 8; p[i] = 0xFF000000 | (((v >> 10) & 31) * 255 / 31 | 0) << 16 | (((v >> 5) & 31) * 255 / 31 | 0) << 8 | ((v & 31) * 255 / 31 | 0); }
    return p;
  }
  const NES = [0x757575,0x24188E,0x0000AA,0x45009E,0x8E0075,0xAA0010,0xA60000,0x7D0800,0x412C00,0x004500,0x005100,0x003C14,0x183C5D,0,0,0,
    0xBCBCBC,0x0070EC,0x2043FF,0x7000F2,0xBC00BC,0xE40069,0xD82800,0xBC3800,0x965600,0x187400,0x008400,0x008C00,0x007C8C,0,0,0,
    0xFFFFFF,0x30A8FF,0x6D7CFF,0xB46CFF,0xFF64FF,0xFF5CA8,0xFF6060,0xFC8A2C,0xE0B100,0xA3D800,0x5CE100,0x3CE6A5,0x2BE1E8,0x4C4C4C,0,0,
    0xFFFFFF,0xACDCFF,0xC6CDFF,0xD9C9FF,0xFFC4FF,0xFFC0E0,0xFFC6C6,0xFFD1B0,0xFFE0A4,0xEEF8A4,0xC7F5B6,0xB6FBD3,0xB2F5FA,0xA0A0A0,0,0];
  function nesColor(i) { const c = NES[i & 63]; return 0xFF000000 | (c & 255) << 16 | (c & 0xFF00) | (c >> 16 & 255); }
  // A world: size x size squares, each 2 x 2 8x8 tiles from the tileset.
  //   rows[y][x]  square id      tile(t) -> index of its top-left in the tileset (+1 right, +32 down)
  //   ts[k]       8x8 tile number    color(k, px) -> 0xAABBGGRR for tileset entry k, pixel value px
  //   pix(tile, x, y) -> pixel value
  // Drawn at half size: every other pixel, a square = 8 x 8.
  function drawWorld(size, rows, tile, ts, pix, color) {
    const W = size * CELL, cv = document.createElement('canvas'); cv.width = W; cv.height = W;
    const g = cv.getContext('2d'), img = g.createImageData(W, W), px = new Uint32Array(img.data.buffer);
    for (let ty = 0; ty < size; ty++) { const row = rows[ty]; for (let tx = 0; tx < size; tx++) {
      const b = tile(row[tx]);
      for (let sy = 0; sy < 2; sy++) for (let sx = 0; sx < 2; sx++) {
        const k = b + sy * 32 + sx, t = ts[k], ox = tx * CELL + sx * 4, oy = ty * CELL + sy * 4;
        for (let y = 0; y < 4; y++) { const o = (oy + y) * W + ox; for (let x = 0; x < 4; x++) px[o + x] = color(k, pix(t, x * 2, y * 2)); }
      }
    } }
    g.putImageData(img, 0, 0);
    return cv;
  }
  // SNES 4bpp, linear (one byte = two pixels, low nibble first): FF4 / FF5 world graphics
  const linear4 = (gfx) => (t, x, y) => (gfx[t * 32 + y * 4 + (x >> 1)] >> (x & 1 ? 4 : 0)) & 15;
  // NES 2bpp planar
  const nes2 = (chr) => (t, x, y) => ((chr[t * 16 + y] >> (7 - x)) & 1) | (((chr[t * 16 + 8 + y] >> (7 - x)) & 1) << 1);
  // run-length rows: rows(count, ptr(i) -> file offset of row i, width, step(r, s, out) -> new s)
  function rows(count, ptr, width, step) {
    const out = [];
    for (let i = 0; i < count; i++) {
      const row = new Uint8Array(width); let s = ptr(i), d = 0, guard = 0;
      while (d < width && guard++ < 4096) s = step(s, (v) => { if (d < width) row[d++] = v; });
      out.push(row);
    }
    return out;
  }
  window.FFMapGfx = { interlace, bgr555, nesColor, drawWorld, linear4, nes2, rows, CELL };

  // ── the map in the tracker ───────────────────────────────────────────────
  const G = window.FFGame, M = G && G.map;
  if (!M) return;
  let viewer = null, romFn = null, last = null, cache = {};
  function rom() {
    let r = null; try { r = romFn && romFn(); } catch (e) {}
    if (!r || !r.length) return null;
    if (r[0] === 0x4E && r[1] === 0x45 && r[2] === 0x53 && r[3] === 0x1A) r = r.subarray(16);   // iNES header
    else if (r.length % 1024 === 512) r = r.subarray(512);                                       // copier header
    return r;
  }
  const PINS = M.places.map((p, i) => ({ world: p.world, x: (p.x + 0.5) * CELL, y: (p.y + 0.5) * CELL, i, boss: !p.checks }));
  window.FFMap = {
    set rom(fn) { romFn = fn; },
    init(host, sections, onToggleItem) {
      viewer = RHWorldMap.create(host, {
        key: 'ffr:' + G.id, pins: PINS, name: (i) => M.places[i].name, counts: (i) => !!M.places[i].checks,
        worlds: M.worlds.map((w, wi) => ({ name: w.name, width: w.size * CELL, height: w.size * CELL,
          picture: () => { const r = rom(); if (!r) return null; if (cache.rom !== r.length) cache = { rom: r.length }; try { return w.draw(r); } catch (e) { console.warn('[ffr map]', e); return null; } } })),
      });
      return viewer;
    },
    // s: the tracker's state ({ sectionId: [bool] }), items: { sectionId: [{ sub }] }
    update(s) {
      if (!viewer) return;
      PINS.forEach((q, i) => { q.x = (M.places[i].x + 0.5) * CELL; q.y = (M.places[i].y + 0.5) * CELL; });   // a game may move them once it has read the ROM
      const have = M.places.map((p) => {
        if (!p.checks) return false;
        let n = 0, done = 0;
        p.checks.forEach(([sid, area]) => { const sec = G.sections.find((x) => x.id === sid); if (!sec) return; sec.items.forEach((it, i) => { if (it.sub === area) { n++; if (s[sid] && s[sid][i]) done++; } }); });
        return n > 0 && done === n;
      });
      viewer.update({ have, liveHave: () => true });
    },
    setParty(mem) {
      if (!viewer) return;
      if (!mem) { viewer.setPos(null); return; }
      let p = null; try { p = M.pos(mem); } catch (e) {}
      if (p) { last = p; viewer.setPos({ world: p.world, x: (p.x + 0.5) * CELL, y: (p.y + 0.5) * CELL }); }
      else if (last) viewer.setPos({ world: last.world, x: (last.x + 0.5) * CELL, y: (last.y + 0.5) * CELL, dim: true });
    },
    redraw() { if (viewer) viewer.redraw(); },
    invalidate() { if (viewer) viewer.invalidate(); },
  };
})();
