/*
 * iconworker.js — Mudora's item pictures, from the game itself.
 *
 * A hidden Snes9x (the same core the game runs on) boots the same ROM, walks
 * Link into a dungeon (module $11, like the boss detour), fills his
 * inventory and opens the pause menu (Start). The menu is the game's own
 * picture of every item, so each icon is cut out of that frame. A few passes
 * with different inventories give each item's versions (bow / silver bow,
 * blue / red boomerang, sword 1–4, bottle contents…). Pure black (the menu's
 * background) becomes see-through. The player's own game is never touched.
 *
 * in:  { rom: ArrayBuffer }
 * out: { icons: { key: ArrayBuffer (16*16 RGBA) } } or { error }
 */
/* global Snes9xCore */
importScripts('../emu/core.js');

var START = 1 << 3;
// $7EF3xx offsets (WRAM $F3xx) set on every pass
var ALL = { 0x342: 1, 0x343: 10, 0x345: 1, 0x346: 1, 0x347: 1, 0x348: 1, 0x349: 1, 0x34A: 1, 0x34B: 1, 0x34D: 1, 0x34E: 1,
  0x34F: 1, 0x350: 1, 0x351: 1, 0x352: 1, 0x353: 2, 0x355: 1, 0x356: 1, 0x357: 1, 0x36C: 0xA0, 0x36D: 0xA0, 0x36E: 0x80, 0x377: 30 };
var PASSES = [
  { sel: 12, set: { 0x340: 2, 0x341: 1, 0x344: 1, 0x34C: 1, 0x35C: 2, 0x354: 1, 0x359: 1, 0x35A: 1, 0x35B: 0 },
    cut: { bow2: [32, 32], boomerang1: [56, 32], hookshot: [80, 32], bomb: [104, 32], mushroom: [128, 32],
      firerod: [32, 56], icerod: [56, 56], bombos: [80, 56], ether: [104, 56], quake: [128, 56],
      lamp: [32, 80], shovel: [80, 80], net: [104, 80], book: [128, 80],
      bottle1: [32, 104], somaria: [56, 104], byrna: [80, 104], cape: [104, 104], mirror: [128, 104],
      boots: [32, 192], gloves1: [64, 192], flippers: [96, 192], moonpearl: [128, 192],
      sword1: [176, 160], shield1: [200, 160], tunic0: [224, 160], // the menu's dungeon row is map, compass, big key (they were swapped, so the
      // map lit up as a big key: Hydro, Oct 2026)
      map: [176, 192], compass: [200, 192], bigkey: [224, 192],
      pendant_red: [200, 88], pendant_blue: [184, 112], pendant_green: [216, 112] } },
  { sel: 14, set: { 0x340: 4, 0x341: 2, 0x344: 2, 0x34C: 2, 0x35C: 3, 0x354: 2, 0x359: 2, 0x35A: 2, 0x35B: 1, 0x3C5: 3 },
    cut: { hammer: [56, 80], bow3: [32, 32], boomerang2: [56, 32], powder: [128, 32], flute: [80, 80], bottle2: [32, 104],
      gloves2: [64, 192], sword2: [176, 160], shield2: [200, 160], tunic1: [224, 160], crystal: [192, 83] } },
  { sel: 12, set: { 0x340: 1, 0x35C: 4, 0x359: 3, 0x35A: 3, 0x35B: 2 },
    cut: { bow1: [32, 32], bottle3: [32, 104], sword3: [176, 160], shield3: [200, 160], tunic2: [224, 160] } },
  { sel: 12, set: { 0x359: 4, 0x35C: 5 }, cut: { sword4: [176, 160], bottle4: [32, 104] } },
  { sel: 12, set: { 0x35C: 6 }, cut: { bottle5: [32, 104] } },
  { sel: 12, set: { 0x35C: 7 }, cut: { bottle6: [32, 104] } },
  { sel: 12, set: { 0x35C: 8 }, cut: { bottle7: [32, 104] } },
];

var MENU_TOP = 15;
// The randomizer's (ALTTPR's) menu moves a few things: the A-button items sit
// higher, and pendants and crystals show together. Which menu it is is found
// from the picture (are there boots at the randomizer's spot?).
var RANDO = { boots: [32, 168], gloves1: [64, 168], flippers: [96, 168], moonpearl: [128, 168], gloves2: [64, 168],
  pendant_green: [200, 72], pendant_blue: [184, 88], pendant_red: [216, 88], crystal: [187, 105] };
// [name, which pass's inventory, what to take away]
var FIND = [
  ['boots', 0, { 0x34B: 0 }], ['gloves1', 0, { 0x354: 0 }], ['flippers', 0, { 0x356: 0 }], ['moonpearl', 0, { 0x357: 0 }],
  ['gloves2', 1, { 0x354: 0 }],
  // pendants: - - - - - green blue red
  ['pendant_red', 0, { 0x374: 6 }], ['pendant_blue', 0, { 0x374: 5 }], ['pendant_green', 0, { 0x374: 3 }],
  // crystals: - w b s t i p m. Take away PoD's (a blue one) for the crystal,
  // and Misery Mire's (red) for the red crystal
  ['crystal', 1, { 0x37A: 0x7D }], ['crystal_red', 1, { 0x37A: 0x7E }],
];
var core = null, base = null;
// the pause menu with a pass's inventory (and anything in `less` changed), as a copied picture
function shot(p, less) {
  core.loadState(base);
  var w = core.wram(), k;
  for (k in ALL) w[0xF000 + +k] = ALL[k];
  for (k in p.set) w[0xF000 + +k] = p.set[k];
  for (k = 0xF364; k <= 0xF369; k++) w[k] = 0xFF;
  w[0xF374] = 7; w[0xF37A] = 0x7F;
  for (k in (less || {})) w[0xF000 + +k] = less[k];
  w[0x202] = p.sel;
  frames(10); frames(4, START); frames(70);
  var f = core.frame(), W = f.w, step = W >= 512 ? 2 : 1, ys = f.h >= 448 ? 2 : 1;
  // one value per game pixel (256 x 224)
  var out = new Uint16Array(256 * 224);
  for (var y = 0; y < 224 && y * ys < f.h; y++) for (var x = 0; x < 256; x++) out[y * 256 + x] = f.data[(y * ys) * W + x * step];
  return out;
}
// Where the item is: the pixels that changed, grouped into blobs (pixels
// within 3 of each other). The blob most like an item picture wins: the most
// colours (a check mark or a number is one colour), then the biggest.
function findIcon(a, b) {
  var pts = [];
  for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) pts.push(i);
  if (!pts.length || pts.length > 4000) return null;
  var group = new Int32Array(pts.length).fill(-1), groups = [];
  for (var p = 0; p < pts.length; p++) {
    if (group[p] >= 0) continue;
    var g = groups.length, q = [p]; group[p] = g;
    var box = { x0: 999, y0: 999, x1: -1, y1: -1, n: 0, cols: {} };
    while (q.length) {
      var c = q.pop(), cx = pts[c] % 256, cy = (pts[c] / 256) | 0;
      box.n++; box.cols[a[pts[c]]] = 1;
      if (cx < box.x0) box.x0 = cx; if (cx > box.x1) box.x1 = cx; if (cy < box.y0) box.y0 = cy; if (cy > box.y1) box.y1 = cy;
      for (var o = 0; o < pts.length; o++) {
        if (group[o] >= 0) continue;
        var ox = pts[o] % 256, oy = (pts[o] / 256) | 0;
        if (Math.abs(ox - cx) <= 3 && Math.abs(oy - cy) <= 3) { group[o] = g; q.push(o); }
      }
    }
    groups.push(box);
  }
  var best = null, bestScore = -1;
  groups.forEach(function (g) {
    var w = g.x1 - g.x0 + 1, h = g.y1 - g.y0 + 1;
    if (w > 18 || h > 18 || g.n < 6) return;
    var score = Object.keys(g.cols).length * 1000 + g.n;
    if (score > bestScore) { bestScore = score; best = g; }
  });
  if (!best) return null;
  // the 16 x 16 square around it
  var x0 = Math.round((best.x0 + best.x1 + 1) / 2 - 8), y0 = Math.round((best.y0 + best.y1 + 1) / 2 - 8);
  return [Math.max(0, Math.min(240, x0)), Math.max(0, Math.min(208, y0))];
}
function cutAt(pic, x0, y0) {
  var px = new Uint8ClampedArray(16 * 16 * 4);
  for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) {
    var v = pic[(y0 + y) * 256 + x0 + x], o = (y * 16 + x) * 4;
    if (!v) continue;
    var r = v >> 11, g = (v >> 5) & 63, b = v & 31;
    px[o] = r << 3 | r >> 2; px[o + 1] = g << 2 | g >> 4; px[o + 2] = b << 3 | b >> 2; px[o + 3] = 255;
  }
  return px;
}
function frames(n, pad) { for (var i = 0; i < n; i++) { core.runFrame(pad || 0, 0); core.audio(); } }
function until(test, max) { for (var i = 0; i < max; i++) { core.runFrame(0, 0); core.audio(); if (test(core.wram())) return true; } return false; }

onmessage = function (ev) {
  Snes9xCore.create('../emu/snes9x.wasm').then(function (c) {
    core = c;
    if (!core.load(new Uint8Array(ev.data.rom))) throw new Error('the ROM did not load');
    frames(300);
    var w = core.wram();
    w[0x10E] = 0x08; w[0x10F] = 0; w[0x10] = 0x11; w[0x11] = 0; w[0xB0] = 0;     // in through Eastern Palace's door
    if (!until(function (x) { return x[0x10] === 7 && x[0x11] === 0 && (x[0x13] & 15) === 15; }, 1500)) throw new Error('couldn\'t get into the game');
    base = core.saveState();
    var icons = {}, dims = [], rando = null;
    PASSES.forEach(function (p) {
      core.loadState(base);
      var w = core.wram(), k;
      for (k in ALL) w[0xF000 + +k] = ALL[k];
      for (k in p.set) w[0xF000 + +k] = p.set[k];
      for (k = 0xF364; k <= 0xF369; k++) w[k] = 0xFF;        // every dungeon's compass, big key, map
      w[0xF374] = 7; w[0xF37A] = 0x7F;                         // pendants, crystals
      w[0x202] = p.sel;                                        // the item picked (the randomizer rings it): one not cut from this picture
      frames(10); frames(4, START); frames(70);
      var f = core.frame(), W = f.w, step = W >= 512 ? 2 : 1, ys = f.h >= 448 ? 2 : 1;
      // where the menu starts: the Y box's top edge (row 15 on a 224-line picture)
      var top = -1;
      for (var y = 0; y < Math.min(60, f.h / ys) && top < 0; y++) {
        if (!f.data[(y * ys) * W + 24 * step]) top = y;     // the box's black outline, under the green backdrop
      }
      var dy = top >= 0 ? top - MENU_TOP : 0;
      dims.push([f.w, f.h, top]);
      if (rando === null) {
        var n = 0;
        for (var yy = 0; yy < 16; yy++) for (var xx = 0; xx < 16; xx++) if (f.data[(168 + dy + yy) * ys * W + (32 + xx) * step]) n++;
        rando = n > 20;
      }
      Object.keys(p.cut).forEach(function (name) {
        var at = rando && RANDO[name] ? RANDO[name] : p.cut[name];
        var x0 = at[0], y0 = at[1], px = new Uint8ClampedArray(16 * 16 * 4);
        for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) {
          var v = f.data[(y0 + y + dy) * ys * W + (x0 + x) * step], o = (y * 16 + x) * 4;
          if (!v) continue;
          var r = v >> 11, g = (v >> 5) & 63, b = v & 31;
          px[o] = r << 3 | r >> 2; px[o + 1] = g << 2 | g >> 4; px[o + 2] = b << 3 | b >> 2; px[o + 3] = 255;
        }
        icons[name] = px.buffer;
      });
    });
    // The randomizer's newer menus move the A-button items, pendants and
    // crystals again (check marks and level numbers where the boots used to
    // be: Robert, Oct 2026). So each of these is found, not assumed: the menu
    // with the item and without it, and the picture is wherever they differ.
    // Not found (or nothing that looks like an item): the fixed spot above stays.
    var found = 0;
    FIND.forEach(function (fd) {
      var on = shot(PASSES[fd[1]]), off = shot(PASSES[fd[1]], fd[2]);
      var at = findIcon(on, off);
      if (!at) return;
      icons[fd[0]] = cutAt(on, at[0], at[1]).buffer;
      found++;
    });
    dims.push(['found', found]);
    var list = Object.keys(icons).map(function (k) { return icons[k]; });
    postMessage({ icons: icons, dims: dims, rando: rando }, list);
  }).catch(function (e) { postMessage({ error: String(e && e.message || e) }); });
};
