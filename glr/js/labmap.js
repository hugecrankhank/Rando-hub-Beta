/*
 * labmap.js — the labyrinth map, drawn from your ROM.
 *
 * Each of the 370 screens is built by running the game's own room-building
 * code (bank 5, called from $EEE0 / $EE1D in the fixed bank) in a small 6502
 * interpreter (js/cpu6502.js). That fills the game's 16 x 12 metatile buffer
 * at $0740 exactly as it does on the console: walls, floor, pyramids, doors,
 * the item spot. GLR then paints those metatiles with per-area colours. The
 * picture-processing parts (graphics uploads, sound) are skipped.
 *
 *   const m = LabMap.read(romBytes);       // rooms parsed, nothing built yet
 *   m.build(onProgress) -> Promise          // builds every screen in slices
 *   m.drawMap(canvas, scale)                // whole 24 x 24 labyrinth
 *   m.drawRoom(canvas, x, y, scale)         // one screen, big
 *   m.doorTile(dir)                         // [col, row] of the door metatile on that side
 */
(function (root) {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const T = node ? require('./tgl-data.js') : root.TGL;
  const CPU = node ? require('./cpu6502.js') : root.CPU6502;

  const W = 16, H = 12;   // metatiles per screen
  // Area colours: [floor, floor 2, wall, wall 2] (NES palette picks).
  const AREA = [
    ['#00A800', '#008800', '#BCBCBC', '#7C7C7C'],   // 0  grass and stone
    ['#0078F8', '#0058F8', '#00A8A8', '#007878'],   // 1  water
    ['#0068D8', '#0048C0', '#3CBCFC', '#0088A8'],   // 2  water
    ['#005800', '#004400', '#00A800', '#58D854'],   // 3  jungle
    ['#006800', '#004C00', '#38B838', '#80D010'],   // 4  jungle
    ['#383838', '#202020', '#BCBCBC', '#989898'],   // 5  rock
    ['#2C2C3C', '#18181C', '#A4A4BC', '#7C7C9C'],   // 6  rock
    ['#6C0040', '#480028', '#F878F8', '#D800CC'],   // 7  flesh
    ['#580058', '#3C003C', '#F8A4C0', '#E45C90'],   // 8  flesh
    ['#AC7C00', '#885800', '#F8B800', '#D89000'],   // 9  desert
    ['#9C6C1C', '#7C4C0C', '#FCA044', '#E07C1C'],   // 10 desert
  ];
  const INNER = {
    corridor: ['#003800', '#002800', '#BCBCBC', '#7C7C7C'],
    message: ['#003800', '#002800', '#BCBCBC', '#7C7C7C'],
    save: ['#282828', '#181818', '#F878F8', '#B800B8'],
    shop: ['#101010', '#000000', '#D8D8D8', '#7C7C7C'],
    inner: ['#101010', '#000000', '#BCBCBC', '#7C7C7C'],
  };
  const DOOR_AT = { U: [7, 3], L: [2, 7], R: [13, 7], D: [7, 10] };

  function read(romIn) {
    const rom = romIn instanceof Uint8Array ? romIn : new Uint8Array(romIn);
    const rooms = T.parseRooms(rom);
    const E = T.edges(rooms);
    const tiles = new Array(576).fill(null);
    let built = 0;

    function buildOne(r) {
      const ram = new Uint8Array(0x800);
      let bank = 5;
      const bus = {
        read(a) {
          if (a < 0x2000) return ram[a & 0x7FF];
          if (a < 0x4020) return a === 0x2002 ? 0x80 : 0;
          if (a < 0x8000) return 0;
          const b = a >= 0xC000 ? 7 : bank;
          return rom[T.HEADER + b * 0x4000 + (a & 0x3FFF)];
        },
        write(a, v) { if (a < 0x2000) ram[a & 0x7FF] = v; else if (a >= 0x8000) bank = v & 7; },
      };
      const cpu = new CPU(bus);
      ram[0x52] = r.x; ram[0x53] = r.y; ram[0xA4] = 4;   // $A4 = 4: no scroll direction
      ram[0x4A] = 1; ram[0x4B] = 1;
      ram.fill(0xFF, 0x04A0, 0x04A9);                     // items taken: show the item spot itself
      const nop = () => {};
      // Skip graphics uploads, palettes, sound, the NMI wait and object spawning.
      const stub = { 0x8000: nop, 0x8006: nop, 0x8036: nop, 0x8039: nop, 0xEFF3: nop, 0xC042: nop, 0xC045: nop, 0xC030: nop, 0xD852: nop };
      cpu.call(0x802D, { stub });
      cpu.call(r.inner ? 0xEE1D : 0xEEE0, { stub, maxSteps: 2000000 });
      return ram.slice(0x740, 0x740 + W * H);
    }
    function tilesOf(x, y) {
      const i = y * 24 + x, r = rooms[i];
      if (r.empty) return null;
      if (!tiles[i]) {
        try { tiles[i] = buildOne(r); } catch (e) { tiles[i] = fallback(r); tiles[i].failed = e.message; }
        built++;
      }
      return tiles[i];
    }
    // If a screen ever fails to build, draw a plain box with its exits.
    function fallback(r) {
      const t = new Uint8Array(W * H).fill(0x70);
      for (let x = 0; x < W; x++) { t[x] = t[W + x] = t[(H - 1) * W + x] = t[2 * W + x] = 0xC1; }
      for (let y = 0; y < H; y++) { t[y * W] = t[y * W + 1] = t[y * W + W - 1] = t[y * W + W - 2] = 0xC1; }
      for (const d of ['U', 'L', 'R', 'D']) if (r.exits[d]) { const [cx, cy] = DOOR_AT[d]; t[cy * W + cx] = 0x08; }
      return t;
    }

    // Every screen's metatiles in one buffer (576 x 192), for the worker.
    function buildAll() {
      const out = new Uint8Array(576 * W * H);
      for (const r of rooms) if (!r.empty) out.set(tilesOf(r.x, r.y), (r.y * 24 + r.x) * W * H);
      return out;
    }
    function setAll(buf) {
      for (const r of rooms) if (!r.empty) { const i = r.y * 24 + r.x; tiles[i] = buf.slice(i * W * H, (i + 1) * W * H); }
      built = rooms.filter((r) => !r.empty).length;
    }
    // Build in a Web Worker (js/labmap-worker.js) so the game keeps running
    // smoothly; falls back to building here in small slices.
    function build(onProgress) {
      if (typeof Worker !== 'undefined' && typeof location !== 'undefined' && location.protocol !== 'file:') {
        return new Promise((resolve) => {
          let w;
          try { w = new Worker('js/labmap-worker.js'); } catch (e) { resolve(buildSlices(onProgress)); return; }
          w.onmessage = (e) => { w.terminate(); if (e.data && e.data.tiles) { setAll(e.data.tiles); if (onProgress) onProgress(1); resolve(); } else resolve(buildSlices(onProgress)); };
          w.onerror = () => { w.terminate(); resolve(buildSlices(onProgress)); };
          w.postMessage({ rom });
        });
      }
      return buildSlices(onProgress);
    }
    // Build every screen without freezing the page (a few dozen per slice).
    function buildSlices(onProgress) {
      const list = rooms.filter((r) => !r.empty);
      let i = 0;
      return new Promise((resolve) => {
        const slice = () => {
          const t0 = Date.now();
          while (i < list.length && Date.now() - t0 < 12) { tilesOf(list[i].x, list[i].y); i++; }
          if (onProgress) onProgress(i / list.length);
          if (i < list.length) setTimeout(slice, 0); else resolve();
        };
        slice();
      });
    }

    function colorsOf(r) {
      if (r.inner) return INNER[r.type] || INNER.inner;
      return AREA[r.area] || AREA[0];
    }

    // Paint one screen's metatiles at (ox, oy), s pixels per metatile.
    function paint(ctx, r, ox, oy, s) {
      const t = tilesOf(r.x, r.y);
      if (!t) return;
      const [f1, f2, w1, w2] = colorsOf(r);
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const id = t[y * W + x], px = ox + x * s, py = oy + y * s;
          if (id >= 0xA0) { ctx.fillStyle = (id ^ (id >> 3)) & 1 ? w2 : w1; ctx.fillRect(px, py, s, s); continue; }
          if (id >= 0x20) { ctx.fillStyle = ((id >> 1) ^ id) & 1 ? f2 : f1; ctx.fillRect(px, py, s, s); continue; }
          ctx.fillStyle = f2; ctx.fillRect(px, py, s, s);
          switch (id) {
            case 0x00: ctx.fillStyle = '#000'; ctx.fillRect(px, py, s, s); break;
            case 0x01: case 0x02: case 0x03: case 0x04: case 0x05: pyramid(ctx, px, py, s, '#F8B800', '#AC7C00'); break;
            case 0x06: box(ctx, px, py, s); break;
            case 0x08: pyramid(ctx, px, py, s, '#3CBCFC', '#0058F8'); break;
            case 0x09: pyramid(ctx, px, py, s, '#FCFCFC', '#D82800'); break;
            case 0x0A: ctx.strokeStyle = '#000'; ctx.lineWidth = Math.max(1, s / 6); ctx.strokeRect(px + s * .15, py + s * .15, s * .7, s * .7); break;
            case 0x0D: ctx.fillStyle = '#000'; ctx.fillRect(px, py, s, s); break;
            default: ctx.fillStyle = '#F878F8'; ctx.fillRect(px + s / 4, py + s / 4, s / 2, s / 2);
          }
        }
      }
    }
    function pyramid(ctx, px, py, s, lit, dark) {
      if (s < 3) { ctx.fillStyle = lit === '#FCFCFC' ? dark : lit; ctx.fillRect(px, py, s, s); return; }
      ctx.fillStyle = dark; ctx.fillRect(px, py, s, s);
      ctx.fillStyle = lit;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + s, py); ctx.lineTo(px + s / 2, py + s / 2); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, py + s); ctx.lineTo(px + s / 2, py + s / 2); ctx.closePath(); ctx.fill();
    }
    function box(ctx, px, py, s) {
      ctx.fillStyle = '#F8B800'; ctx.fillRect(px, py, s, s);
      if (s >= 3) { ctx.fillStyle = '#D82800'; ctx.fillRect(px + s / 3, py + s / 3, Math.max(1, s / 3), Math.max(1, s / 3)); }
    }

    // Key symbols on doors (see TGL.edges): drawn on the door metatile of
    // each side. keyIcon(k) returns a loaded image for key k, or null.
    function paintDoors(ctx, r, ox, oy, s, keyIcon, size) {
      if (!keyIcon) return;
      for (const e of E.get(r) || []) {
        if (!e.key) continue;
        const im = keyIcon(e.key);
        if (!im) continue;
        const [cx, cy] = DOOR_AT[e.dir];
        const z = size || s * 3;
        ctx.drawImage(im, ox + (cx + .5) * s - z / 2, oy + (cy + .5) * s - z / 2, z, z);
      }
    }
    function drawMap(canvas, s, o) {
      s = s || 2; o = o || {};
      canvas.width = 24 * W * s; canvas.height = 24 * H * s;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      for (const r of rooms) if (!r.empty) paint(ctx, r, r.x * W * s, r.y * H * s, s);
      for (const r of rooms) if (!r.empty) paintDoors(ctx, r, r.x * W * s, r.y * H * s, s, o.keyIcon, s * 5);
      return canvas;
    }
    function drawRoom(canvas, x, y, s, o) {
      s = s || 12; o = o || {};
      canvas.width = W * s; canvas.height = H * s;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      const r = rooms[y * 24 + x];
      if (r && !r.empty) { paint(ctx, r, 0, 0, s); paintDoors(ctx, r, 0, 0, s, o.keyIcon, s * 1.6); }
      return canvas;
    }

    return {
      rom, rooms, edges: E, W, H, DOOR_AT, tilesOf, build, buildAll, setAll, drawMap, drawRoom, paint,
      room: (x, y) => rooms[y * 24 + x],
      doorTile: (d) => DOOR_AT[d],
      get built() { return built; },
    };
  }

  const api = { read, AREA, INNER, W, H };
  if (node) module.exports = api;
  else root.LabMap = api;
})(typeof self !== 'undefined' ? self : this);
