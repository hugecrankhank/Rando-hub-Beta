/*
 * dgworker.js — draws whole dungeon rooms for the "Full" dungeon map.
 *
 * Runs a second, hidden Snes9x (the same core the game runs on) with the
 * same ROM, and lets the game's own code build each room: Link goes in
 * through the dungeon's entrance (module $11, like the boss detour), then is
 * sent room by room with the warp-tile transition ($A0 = room, submodule
 * $15). After each room is built, the whole 512 x 512 room is in WRAM as two
 * 64 x 64 tilemaps ($7E2000 BG2, $7E4000 BG1); the tiles come from VRAM (in
 * Snes9x's save state, block "VRA") and the colours from the palette buffer
 * ($7EC500). The player's own game is never touched.
 *
 * in:  { rom: ArrayBuffer, jobs: [{ key, entrance, rooms: [id, …] }, …] }
 * out: { room, key, px: ArrayBuffer (512*512 RGBA) } per room,
 *      { progress: n, total }, { done: true }, { error }
 */
/* global Snes9xCore */
importScripts('../emu/core.js');

var core = null;
function frames(n) { for (var i = 0; i < n; i++) { core.runFrame(0, 0); core.audio(); } }
function until(test, max) {
  for (var i = 0; i < max; i++) { core.runFrame(0, 0); core.audio(); if (test(core.wram())) return true; }
  return false;
}
function playing(w) { return w[0x10] === 0x07 && w[0x11] === 0 && (w[0x13] & 0x0F) === 0x0F; }
function healthy(w) {
  w[0xF36C] = 0xA0; w[0xF36D] = 0xA0;   // full hearts, so nothing in the rooms ends the trip
  w[0xF34A] = 1;                        // the lamp (dark rooms)
}
function enter(entrance) {
  var w = core.wram();
  healthy(w);
  w[0x10E] = entrance; w[0x10F] = 0; w[0x10] = 0x11; w[0x11] = 0; w[0xB0] = 0;
  return until(playing, 1200);
}
function warp(room) {
  var w = core.wram();
  healthy(w);
  w[0xA2] = w[0xA0]; w[0xA3] = w[0xA1];
  w[0xA0] = room & 0xFF; w[0xA1] = room >> 8;
  w[0x11] = 0x15; w[0xB0] = 0;
  return until(function (x) { return playing(x) && (x[0xA0] | x[0xA1] << 8) === room; }, 900);
}

function findVram(st) {
  for (var i = 0; i < st.length - 11; i++) {
    if (st[i] === 0x56 && st[i + 1] === 0x52 && st[i + 2] === 0x41 && st[i + 3] === 0x3A) return st.subarray(i + 11, i + 11 + 0x10000);
  }
  return null;
}
// BG1/BG2 tiles start at VRAM byte $4000 (BG12NBA = $22)
function draw(w, vram) {
  var pal = new Uint32Array(256), i;
  for (i = 0; i < 256; i++) {
    var c = w[0xC500 + i * 2] | w[0xC501 + i * 2] << 8;
    var r = (c & 31) << 3, g = (c >> 5 & 31) << 3, b = (c >> 10 & 31) << 3;
    pal[i] = (0xFF000000 | (b | b >> 5) << 16 | (g | g >> 5) << 8 | (r | r >> 5)) >>> 0;
  }
  var out = new Uint32Array(512 * 512);   // nothing drawn: see-through
  function layer(base, pri) {
    for (var ty = 0; ty < 64; ty++) for (var tx = 0; tx < 64; tx++) {
      var o = base + (ty * 64 + tx) * 2, t = w[o] | w[o + 1] << 8;
      if (((t >> 13) & 1) !== pri) continue;
      var a = 0x4000 + (t & 0x3FF) * 32, p = ((t >> 10) & 7) * 16, hf = t & 0x4000, vf = t & 0x8000;
      if (a + 32 > vram.length) continue;
      for (var y = 0; y < 8; y++) {
        var ry = vf ? 7 - y : y, b0 = vram[a + ry * 2], b1 = vram[a + ry * 2 + 1], b2 = vram[a + 16 + ry * 2], b3 = vram[a + 17 + ry * 2];
        var row = (ty * 8 + y) * 512 + tx * 8;
        for (var x = 0; x < 8; x++) {
          var s = hf ? x : 7 - x, v = (b0 >> s & 1) | (b1 >> s & 1) << 1 | (b2 >> s & 1) << 2 | (b3 >> s & 1) << 3;
          if (v) out[row + x] = pal[p + v];
        }
      }
    }
  }
  layer(0x2000, 0); layer(0x4000, 0); layer(0x2000, 1); layer(0x4000, 1);
  return out;
}

onmessage = function (ev) {
  var m = ev.data;
  Snes9xCore.create('../emu/snes9x.wasm').then(function (c) {
    core = c;
    if (!core.load(new Uint8Array(m.rom))) throw new Error('the ROM did not load');
    frames(300);
    var boot = core.saveState();
    var total = 0, n = 0;
    m.jobs.forEach(function (j) { total += j.rooms.length; });
    m.jobs.forEach(function (j) {
      core.loadState(boot);
      var inside = enter(j.entrance);
      j.rooms.forEach(function (id) {
        n++;
        if (!inside) { core.loadState(boot); inside = enter(j.entrance); }
        if (inside && warp(id)) {
          var st = core.saveState(), vram = st && findVram(st);
          if (vram) { var px = draw(core.wram(), vram); postMessage({ key: j.key, room: id, px: px.buffer }, [px.buffer]); }
        } else inside = false;     // start the next room from the entrance again
        postMessage({ progress: n, total: total });
      });
    });
    postMessage({ done: true });
  }).catch(function (e) { postMessage({ error: String(e && e.message || e) }); });
};
