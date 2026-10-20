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
      sword1: [176, 160], shield1: [200, 160], tunic0: [224, 160], bigkey: [176, 192], compass: [200, 192], map: [224, 192],
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
var core = null;
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
    var base = core.saveState(), icons = {}, dims = [], rando = null;
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
    var list = Object.keys(icons).map(function (k) { return icons[k]; });
    postMessage({ icons: icons, dims: dims, rando: rando }, list);
  }).catch(function (e) { postMessage({ error: String(e && e.message || e) }); });
};
