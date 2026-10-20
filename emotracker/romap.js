/*
 * romap.js — the Light and Dark World maps, drawn from the game itself.
 *
 * Instead of shipping map pictures, Rando Hub draws both worlds from the ROM
 * that's running (or the Base ROM), pixel for pixel: each 512 x 512 screen is
 * decompressed from the game's own map data (map32 → map16 → 8x8 tiles), with
 * the graphics sheets and palettes the game loads for that area. The result is
 * the full 4096 x 4096 overworld, sharp at any size, and for seeds that change
 * the overworld (inverted), the map of that seed.
 *
 * The formats follow zelda3 by snesrev (MIT): Decompress / Decompress_bank02,
 * Do3To4Low/High, Overworld_ParseMap32Definition, Palette_Load_OWBG*, and its
 * kMainTilesets / kAuxTilesets / kOwBgPalInfo tables (copied below). Addresses
 * are for the Japanese 1.0 ROM, which the randomizer is built on.
 *
 * window.RoMap.render(romBytes) → Promise<{ light: [64 Blobs], dark: [64 Blobs] }> | null
 * (row by row, 8 screens across)
 * (null when the ROM doesn't look like ALTTP JP 1.0 / a randomizer seed).
 */
(function () {
  'use strict';

  // ── addresses (file offsets, JP 1.0 / randomizer) ─────────────────────────
  var GFX_BANK = 0x4fc0, GFX_HI = 0x509f, GFX_LO = 0x517e;   // BG sheet pointers
  var MAP_HI = 0x176b1, MAP_LO = 0x176b1 + 480;               // 160 screens, 3-byte pointers
  var AREA_HEAD = 0x124e3;                                    // which screen leads each area
  var M32 = [0x18000, 0x1b3c0, 0x20000, 0x233c0];             // map32 → map16: TL, TR, BL, BR
  var M16 = 0x78000;                                          // map16 → 4 tile words
  var AUX_THEME = 0x7c9c, AREA_PAL = 0x7d1c;                  // per area
  var PAL_MAIN = 0xde6c8, PAL_AUX12 = 0xde86c, PAL_AUX3 = 0xde604;

  // zelda3 (MIT): kMainTilesets[0x20], [0x21]; kAuxTilesets; kOwBgPalInfo
  var MAIN = { lw: [58, 59, 60, 61, 83, 77, 62, 91], dw: [66, 67, 68, 69, 32, 43, 63, 89] };
  var AUX = [[6,0,31,24],[8,0,34,27],[6,0,31,24],[7,0,35,28],[7,0,33,24],[9,0,32,25],[11,0,33,26],[12,0,36,25],[8,0,34,27],[12,0,37,27],[12,0,38,27],[10,0,39,29],[10,0,40,30],[11,0,41,22],[13,0,42,24],[7,0,35,28],[7,0,4,5],[7,0,4,5],[9,0,32,27],[9,0,42,23],[11,0,33,28],[9,0,32,25],[11,0,33,26],[9,0,36,27],[8,0,34,27],[9,0,37,27],[9,0,38,27],[10,0,39,29],[9,0,40,30],[12,0,41,22],[13,0,42,23],[114,0,43,93],[0,0,0,0],[0,87,76,0],[0,86,79,0],[0,83,77,0],[0,82,73,0],[0,85,74,0],[0,83,84,0],[0,81,78,0],[0,0,0,0],[0,80,75,0],[0,83,77,0],[0,85,84,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,71,72,0],[0,0,0,0],[0,87,76,0],[0,86,79,0],[0,83,77,0],[0,82,73,0],[0,85,74,0],[0,83,84,0],[0,81,78,0],[0,0,0,0],[0,80,75,0],[0,83,0,0],[0,53,54,0],[0,96,52,0],[0,43,44,0],[0,45,46,0],[0,47,48,0],[0,55,56,0],[0,51,52,0],[0,49,50,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[114,113,114,113],[23,64,65,57]];
  var PALINFO = [0,-1,7,0,1,7,0,2,7,0,3,7,0,4,7,0,5,7,0,6,7,7,6,5,0,8,7,0,9,7,0,10,7,0,11,7,0,-1,7,0,-1,7,3,4,7,4,4,3,16,-1,6,16,1,6,16,17,6,16,3,6,16,4,6,16,5,6,16,6,6,18,19,4,18,5,4,16,9,6,16,11,6,16,12,6,16,13,6,16,14,6,16,15,6];

  // ── decompression (the game's LZ format) ──────────────────────────────────
  function decomp(rom, p, bigEndianOffsets, limit) {
    var out = new Uint8Array(limit || 0x2000), n = 0;
    for (var guard = 0; guard < 100000; guard++) {
      if (p >= rom.length) return null;
      var b = rom[p++];
      if (b === 0xff) return out.subarray(0, n);
      var cmd, len;
      if ((b & 0xe0) !== 0xe0) { len = (b & 0x1f) + 1; cmd = b & 0xe0; }
      else { cmd = (b << 3) & 0xe0; len = (((b & 3) << 8) | rom[p++]) + 1; }
      if (n + len > out.length) return null;
      if (cmd === 0) { for (var i = 0; i < len; i++) out[n++] = rom[p++]; }
      else if (cmd & 0x80) {
        var o = bigEndianOffsets ? (rom[p] << 8 | rom[p + 1]) : (rom[p] | rom[p + 1] << 8); p += 2;
        if (o >= n) return null;
        for (var j = 0; j < len; j++) out[n++] = out[o + j];
      } else if (!(cmd & 0x40)) { var v = rom[p++]; for (var k = 0; k < len; k++) out[n++] = v; }
      else if (!(cmd & 0x20)) { var a = rom[p++], c = rom[p++]; for (var m = 0; m < len; m++) out[n++] = (m & 1) ? c : a; }
      else { var s = rom[p++]; for (var q = 0; q < len; q++) out[n++] = (s + q) & 0xff; }
    }
    return null;
  }
  function pc(ea) { return ((ea >> 16) & 0x7f) * 0x8000 + (ea & 0x7fff); }
  function p24(rom, o) { return rom[o] | rom[o + 1] << 8 | rom[o + 2] << 16; }
  function w(rom, o) { return rom[o] | rom[o + 1] << 8; }

  // ── graphics: a 3bpp sheet → 64 tiles of 8x8 colour indexes ───────────────
  function sheetTiles(rom, i, high, cache) {
    var key = i + (high ? 'h' : 'l');
    if (cache[key]) return cache[key];
    var a = (rom[GFX_BANK + i] << 16) | (rom[GFX_HI + i] << 8) | rom[GFX_LO + i];
    var d = decomp(rom, pc(a), false, 0x800);
    var t = new Uint8Array(64 * 64);
    if (d && d.length >= 0x600) {
      for (var n = 0; n < 64; n++) {
        var b = n * 24;
        for (var y = 0; y < 8; y++) {
          var p0 = d[b + y * 2], p1 = d[b + y * 2 + 1], p2 = d[b + 16 + y];
          for (var x = 0; x < 8; x++) {
            var s = 7 - x;
            var v = ((p0 >> s) & 1) | (((p1 >> s) & 1) << 1) | (((p2 >> s) & 1) << 2);
            if (high && v) v |= 8;
            t[n * 64 + y * 8 + x] = v;
          }
        }
      }
    }
    cache[key] = t;
    return t;
  }
  // The 8 sheets the game loads for an area (InitializeTilesets), 512 tiles.
  function areaTiles(rom, head, cache) {
    var dw = head & 0x40, mt = dw ? MAIN.dw : MAIN.lw;
    var at = AUX[rom[AUX_THEME + head]] || [0, 0, 0, 0];
    var subs = [mt[0], mt[1], mt[2], at[0] || mt[3], at[1] || mt[4], at[2] || mt[5], at[3] || mt[6], mt[7]];
    var slots = [7, 6, 5, 4, 3, 2, 1, 0];
    return subs.map(function (s, i) { var sl = slots[i]; return sheetTiles(rom, s, sl === 7 || sl === 2 || sl === 3 || sl === 4, cache); });
  }

  // ── palettes (Palette_Load_OWBGMain / OWBG1 / OWBG2 / OWBG3) ──────────────
  function rgb(c) { return [(c & 31) << 3 | (c & 31) >> 2, ((c >> 5) & 31) << 3 | ((c >> 5) & 31) >> 2, ((c >> 10) & 31) << 3 | ((c >> 10) & 31) >> 2]; }
  function areaPalette(rom, head) {
    var cg = new Uint16Array(128);
    function multi(base, off, dst, x, y) {
      x++;
      for (var r = 0; r <= y; r++) for (var i = 0; i < x; i++) cg[(dst >> 1) + r * 16 + i] = w(rom, base + (off + r * x + i) * 2);
    }
    var sc = head & 0x3f, mode = (sc === 3 || sc === 5 || sc === 7 ? 2 : 0) + (head & 0x40 ? 1 : 0);
    multi(PAL_MAIN, mode * 35, 0x42, 6, 4);
    var pi = rom[AREA_PAL + head] * 3, a1 = Math.max(0, PALINFO[pi] || 0), a2 = Math.max(0, PALINFO[pi + 1] || 0), a3 = Math.max(0, PALINFO[pi + 2] || 0);
    multi(PAL_AUX12, a1 * 21, 0x52, 6, 2);
    multi(PAL_AUX12, a2 * 21, 0xb2, 6, 2);
    for (var i = 0; i < 7; i++) cg[(0xe2 >> 1) + i] = w(rom, PAL_AUX3 + (a3 * 7 + i) * 2);
    var out = new Uint8Array(128 * 3);
    for (var k = 0; k < 128; k++) { var c = rgb(cg[k]); out[k * 3] = c[0]; out[k * 3 + 1] = c[1]; out[k * 3 + 2] = c[2]; }
    // Death Mountain's open sky: in the game the cloud layer shows through
    // there; the plain backdrop (grass green) looked wrong, so the sky's teal
    var dm = !(head & 0x40) && (sc === 3 || sc === 5 || sc === 7);
    return { pal: out, back: dm ? [48, 96, 96] : rgb(head & 0x40 ? 0x2a32 : 0x2669) };
  }

  // ── one 512 x 512 screen into the world's pixel buffer ────────────────────
  function drawScreen(rom, screen, px, worldW, ox, oy, cache) {
    var head = (rom[AREA_HEAD + (screen & 63)] & 63) | (screen & 0x40);
    var sheets = areaTiles(rom, head, cache), P = areaPalette(rom, head);
    var hi = decomp(rom, pc(p24(rom, MAP_HI + screen * 3)), true, 0x400);
    var lo = decomp(rom, pc(p24(rom, MAP_LO + screen * 3)), true, 0x400);
    if (!hi || !lo || hi.length < 256 || lo.length < 256) return false;
    var bd = P.back, pal = P.pal;
    for (var y = 0; y < 512; y++) {
      var row = ((oy + y) * worldW + ox) * 4;
      for (var x = 0; x < 512; x++) { var q = row + x * 4; px[q] = bd[0]; px[q + 1] = bd[1]; px[q + 2] = bd[2]; px[q + 3] = 255; }
    }
    for (var j = 0; j < 16; j++) for (var i = 0; i < 16; i++) {
      var m32 = lo[j * 16 + i] | hi[j * 16 + i] << 8;
      var g = (m32 >> 2) * 6, k = m32 & 3;
      for (var qd = 0; qd < 4; qd++) {
        var o = M32[qd] + g;
        var m16lo = rom[o + k];
        var nib = k === 0 ? rom[o + 4] >> 4 : k === 1 ? rom[o + 4] & 15 : k === 2 ? rom[o + 5] >> 4 : rom[o + 5] & 15;
        var m16 = m16lo | nib << 8;
        for (var t = 0; t < 4; t++) {
          var tw = w(rom, M16 + m16 * 8 + t * 2);
          var tn = tw & 0x3ff;
          if (tn >= 512) continue;
          var tiles = sheets[tn >> 6], base = (tn & 63) * 64, palb = ((tw >> 10) & 7) * 16;
          var hf = tw & 0x4000, vf = tw & 0x8000;
          var X = ox + i * 32 + (qd & 1) * 16 + (t & 1) * 8, Y = oy + j * 32 + (qd >> 1) * 16 + (t >> 1) * 8;
          for (var yy = 0; yy < 8; yy++) {
            var sy = vf ? 7 - yy : yy, prow = ((Y + yy) * worldW + X) * 4;
            for (var xx = 0; xx < 8; xx++) {
              var v = tiles[base + sy * 8 + (hf ? 7 - xx : xx)];
              if (!v) continue;
              var ci = (palb + v) * 3, pq = prow + xx * 4;
              px[pq] = pal[ci]; px[pq + 1] = pal[ci + 1]; px[pq + 2] = pal[ci + 2];
            }
          }
        }
      }
    }
    return true;
  }

  // Sanity checks: does this look like a JP 1.0-based ALTTP ROM?
  function looksRight(rom) {
    if (!rom || rom.length < 0x100000) return false;
    var ok = 0;
    for (var s = 0; s < 160; s += 9) {
      var h = decomp(rom, pc(p24(rom, MAP_HI + s * 3)), true, 0x400);
      if (h && h.length === 256) ok++;
    }
    var sh = 0;
    for (var i = 58; i < 70; i++) {
      var a = (rom[GFX_BANK + i] << 16) | (rom[GFX_HI + i] << 8) | rom[GFX_LO + i];
      var d = decomp(rom, pc(a), false, 0x800);
      if (d && d.length === 0x600) sh++;
    }
    return ok >= 17 && sh >= 10;
  }

  // Each world as 64 separate 512 x 512 screens: one 4096 x 4096 picture is
  // more than phones (iPhone Safari) will draw.
  function renderWorld(rom, dw) {
    var cv = document.createElement('canvas');
    cv.width = 512; cv.height = 512;
    var ctx = cv.getContext('2d'), cache = {}, out = [];
    var s = 0;
    return new Promise(function (res) {
      function next() {
        if (s >= 64) { res(out); return; }
        var img = ctx.createImageData(512, 512);
        drawScreen(rom, s + (dw ? 64 : 0), img.data, 512, 0, 0, cache);
        ctx.putImageData(img, 0, 0);
        cv.toBlob(function (b) { out.push(b); s++; next(); }, 'image/png');
      }
      next();
    });
  }

  window.RoMap = {
    looksRight: looksRight,
    render: function (bytes) {
      var rom = bytes.length % 1024 === 512 ? bytes.subarray(512) : bytes;
      if (!looksRight(rom)) return null;
      return renderWorld(rom, false).then(function (light) {
        return renderWorld(rom, true).then(function (dark) { return { light: light, dark: dark }; });
      });
    },
  };
})();
