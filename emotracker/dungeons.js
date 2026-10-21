/*
 * dungeons.js — dungeon maps for the EmoTracker page. Three kinds:
 *
 * "Explore" (fog of war): each room is captured from the game's own picture
 * as you walk through it, so the dungeon fills in as you explore.
 *
 * "Map" (like the game's pause map): every floor as a grid of rooms. Rooms
 * you've been in are filled in; with the dungeon's map the rest show as
 * outlines, and with its compass the boss room is marked.
 *
 * "Full" (desktop): every room drawn whole, up front. A hidden copy of the
 * emulator builds each room with the game's own code (dgworker.js), once per
 * game, and keeps the pictures. Best for players learning rando / pots.
 *
 * Rooms are laid out by floor, from the game's own pause-map tables (ROM,
 * bank $0A: a pointer per dungeon to 5 x 5 room ids per floor, lowest floor
 * first). Floor names and boss rooms follow zelda3 (MIT, snesrev).
 *
 * Above the maps: World and a button per dungeon. Entering a dungeon shows its
 * map; leaving shows the world again (unless you picked one by hand).
 *
 * What it reads (WRAM): $10 module (7 = indoors), $11 submodule (0 = playing),
 * $1B indoors, $13 screen brightness, $A0 room, $040C dungeon, $E2/$E8 BG2
 * scroll (the camera, in the underworld's coordinates: each room is 512 x 512,
 * room x = id & 15, y = id >> 4), $20/$22 Link, $7EF000 + room * 2 room flags
 * (low 4 bits: quarters visited), $7EF364 compasses, $7EF368 maps.
 */
(function () {
  'use strict';
  // the worker sits next to this file (pages in other folders load it too)
  var HERE = (function () { try { return new URL('.', document.currentScript.src).href; } catch (e) { return ''; } })();
  var E = window.EmoWeb;
  // per palace ($040C >> 1): entrance (to go in by), boss room, basement floors, layout size
  var PALACE = [
    { name: 'Sewers', ent: 0x02, boss: -1, low: 1, size: 75 }, { ent: 0x04, boss: -1, low: 3, size: 125 },
    { ent: 0x08, boss: 0xC8, low: 0, size: 50 }, { ent: 0x09, boss: 0x33, low: 1, size: 75 },
    { ent: 0x24, boss: 0x20, low: 0, size: 175 }, { ent: 0x25, boss: 0x06, low: 2, size: 75 },
    { ent: 0x26, boss: 0x5A, low: 1, size: 50 }, { ent: 0x27, boss: 0x90, low: 2, size: 75 },
    { ent: 0x2B, boss: 0x29, low: 2, size: 50 }, { ent: 0x2D, boss: 0xDE, low: 7, size: 200 },
    { ent: 0x33, boss: 0x07, low: 0, size: 150 }, { ent: 0x34, boss: 0xAC, low: 2, size: 75 },
    { ent: 0x35, boss: 0xA4, low: 3, size: 100 }, { ent: 0x37, boss: 0x0D, low: 1, size: 200 }];
  var DUNGEONS = [
    // [$040C >> 1 values (the first ones' floors come first), short name, full name]
    [[1, 0], 'HC', 'Hyrule Castle'], [[2], 'EP', 'Eastern Palace'], [[3], 'DP', 'Desert Palace'],
    [[10], 'ToH', 'Tower of Hera'], [[4], 'AT', "Agahnim's Tower"], [[6], 'PoD', 'Palace of Darkness'],
    [[5], 'SP', 'Swamp Palace'], [[8], 'SW', 'Skull Woods'], [[11], 'TT', "Thieves' Town"],
    [[9], 'IP', 'Ice Palace'], [[7], 'MM', 'Misery Mire'], [[12], 'TR', 'Turtle Rock'], [[13], 'GT', "Ganon's Tower"]];
  function dgOf(code) {
    for (var i = 0; i < DUNGEONS.length; i++) if (DUNGEONS[i][0].indexOf(code) >= 0) return i;
    return -1;
  }

  // ── which kind ────────────────────────────────────────────────────────────
  var MODE_KEY = 'rhb-emo-dgmode', pref = 'explore';
  try { pref = localStorage.getItem(MODE_KEY) || 'explore'; } catch (e) {}
  if (['explore', 'map', 'full'].indexOf(pref) < 0) pref = 'explore';
  function phone() { return document.body.classList.contains('phone'); }
  function mode() { return pref === 'full' && phone() ? 'explore' : pref; }

  // ── captured rooms (Explore) ──────────────────────────────────────────────
  var rooms = {};        // room id → { px: Uint8ClampedArray(512*512*4), dg, dirty, changed }
  var full = {};         // room id → { url } (Full: pictures built by dgworker.js)
  var game = null;
  function room(id, dg) {
    var r = rooms[id];
    if (!r) { r = rooms[id] = { px: new Uint8ClampedArray(512 * 512 * 4), dg: dg, dirty: false, saved: 0, changed: 1 }; }
    if (dg >= 0) r.dg = dg;
    return r;
  }

  function findPlayer() {
    var w = window, seen = [];
    for (var i = 0; i < 6 && w && seen.indexOf(w) < 0; i++) {
      seen.push(w);
      try { if (w.Snes9xPlayer) return w.Snes9xPlayer; } catch (e) {}
      try { w = w.parent && w.parent !== w ? w.parent : w.opener; } catch (e) { w = null; }
    }
    return null;
  }
  function bridge() { var b = E.bridge && E.bridge(); return b && b.ready() ? b : null; }
  function wram(addr, len) {
    var b = bridge();
    if (!b) return null;
    try { return b.read(0xF50000 + addr, len); } catch (e) { return null; }
  }

  // ── floors, from the game's pause-map tables ──────────────────────────────
  var layouts = null;    // per palace: [{ label, cells: [25 room ids, 0x0F = none] }, …] lowest first
  function readLayouts() {
    var b = bridge();
    if (!b) return null;
    try {
      var ok = function (t) { for (var i = 0; i < 13; i++) if ((t[i * 2 + 2] | t[i * 2 + 3] << 8) - (t[i * 2] | t[i * 2 + 1] << 8) !== PALACE[i].size) return false; return true; };
      var at = 0x57615, t = b.read(at, 28);
      if (!ok(t)) {                      // not where the JP 1.0 game has it: look through bank $0A
        var bank = b.read(0x50000, 0x8000); at = -1;
        for (var o = 0; o < bank.length - 28 && at < 0; o++) if (ok(bank.subarray(o, o + 28))) at = 0x50000 + o;
        if (at < 0) return null;
        t = b.read(at, 28);
      }
      return PALACE.map(function (P, p) {
        var ptr = t[p * 2] | t[p * 2 + 1] << 8, d = b.read(0x50000 + ptr - 0x8000, P.size), fl = [];
        for (var f = 0; f * 25 < P.size; f++) {
          var n = f - P.low, cells = Array.prototype.slice.call(d.subarray(f * 25, f * 25 + 25));
          fl.push({ label: (P.name ? P.name + ' ' : '') + (n < 0 ? 'B' + (-n) : (n + 1) + 'F'), cells: cells });
        }
        return fl;
      });
    } catch (e) { return null; }
  }
  // a dungeon's floors (top floor first), each with the columns/rows its part of the dungeon uses
  function floorsOf(dg) {
    if (!layouts) return null;
    var out = [];
    DUNGEONS[dg][0].forEach(function (p) {
      var c0 = 5, r0 = 5, c1 = -1, r1 = -1, mine = [];
      layouts[p].slice().reverse().forEach(function (f) {
        var any = false;
        f.cells.forEach(function (id, k) {
          if (id === 0x0F) return;
          any = true;
          c0 = Math.min(c0, k % 5); c1 = Math.max(c1, k % 5); r0 = Math.min(r0, (k / 5) | 0); r1 = Math.max(r1, (k / 5) | 0);
        });
        if (any) mine.push({ label: f.label, cells: f.cells, palace: p });
      });
      mine.forEach(function (f) { f.c0 = c0; f.r0 = r0; f.cw = c1 - c0 + 1; f.ch = r1 - r0 + 1; out.push(f); });
    });
    return out.length ? { floors: out } : null;
  }

  // ── where Link is, and the explore capture ────────────────────────────────
  var where = { indoors: false, dg: -1, room: -1, x: 0, y: 0 };
  var flags = null, dgItems = { map: 0, compass: 0 };
  var HUD = 40;   // the top lines show the HUD over the room
  // …and the magic meter hangs down the left side below them
  var METER_W = 40, METER_H = 72;
  function capture() {
    var m = wram(0x10, 2), b1b = wram(0x1B, 1), bri = wram(0x13, 1), r = wram(0xA0, 2), d = wram(0x40C, 1),
      sx = wram(0xE2, 2), sy = wram(0xE8, 2), lk = wram(0x20, 4);
    if (!m || !r || !d || !sx || !sy) return;
    // a text box or the pause menu ($10 = $0E) is drawn over the room: Link
    // hasn't gone anywhere, so keep showing where he is
    if (m[0] === 0x0E) return;
    flags = wram(0xF000, 0x250);
    var it = wram(0xF364, 6);
    if (it) dgItems = { compass: it[0] | it[1] << 8, map: it[4] | it[5] << 8 };
    var indoors = m[0] === 0x07 && b1b[0] === 1;
    var dg = d[0] === 0xFF ? -1 : dgOf(d[0] >> 1);
    var id = r[0] | (r[1] << 8);
    var was = where.dg;
    where = { indoors: indoors, dg: indoors ? dg : -1, room: id, y: lk ? lk[0] | lk[1] << 8 : 0, x: lk ? lk[2] | lk[3] << 8 : 0 };
    if (where.dg !== was && Dg.onEnter) Dg.onEnter(where.dg);
    if (!indoors || dg < 0 || m[1] !== 0 || (bri[0] & 0x0F) !== 0x0F) return;
    var P = findPlayer(), core = P && P.core;
    if (!core) return;
    var f;
    try { f = core.frame(); } catch (e) { return; }
    if (!f || !f.w || !f.h) return;
    var step = f.w >= 512 ? 2 : 1, W = Math.floor(f.w / step), H = Math.min(f.h, 224);
    var camX = sx[0] | sx[1] << 8, camY = sy[0] | sy[1] << 8;
    var rx = id & 15, ry = id >> 4;
    // not a dark room (no lamp): mostly black frames aren't kept
    var dark = 0, tot = 0;
    for (var y0 = HUD; y0 < H; y0 += 8) for (var x0 = 0; x0 < W; x0 += 8) { tot++; if (!f.data[y0 * f.w + x0 * step]) dark++; }
    if (dark > tot * 0.85) return;
    var R = room(id, dg), px = R.px, n = 0;
    for (var y = HUD; y < H; y++) {
      var wy = camY + y; if ((wy >> 9) !== ry) continue;
      var ly = wy & 511;
      for (var x = 0; x < W; x++) {
        if (x < METER_W && y < METER_H) continue;
        var wx = camX + x; if ((wx >> 9) !== rx) continue;
        var c = f.data[y * f.w + x * step], q = (ly * 512 + (wx & 511)) * 4;
        var r5 = c >> 11, g6 = (c >> 5) & 63, b5 = c & 31;
        px[q] = r5 << 3 | r5 >> 2; px[q + 1] = g6 << 2 | g6 >> 4; px[q + 2] = b5 << 3 | b5 >> 2; px[q + 3] = 255;
        n++;
      }
    }
    if (n) { R.dirty = true; R.changed++; }
  }
  function visited(id) { return !!(flags && id * 2 < flags.length && (flags[id * 2] & 0x0F)); }

  // ── keeping them (per game) ───────────────────────────────────────────────
  var dbP = null;
  function idb() {
    if (!dbP) dbP = new Promise(function (res, rej) {
      var q = indexedDB.open('rhb-emo-dungeons', 2);
      q.onupgradeneeded = function () {
        var db = q.result;
        if (!db.objectStoreNames.contains('rooms')) db.createObjectStore('rooms');
        if (!db.objectStoreNames.contains('full')) db.createObjectStore('full');
      };
      q.onsuccess = function () { res(q.result); }; q.onerror = function () { dbP = null; rej(q.error); };
    });
    return dbP;
  }
  function saveDirty() {
    if (!game) return;
    var g = game;
    Object.keys(rooms).forEach(function (id) {
      var R = rooms[id];
      if (!R.dirty || Date.now() - R.saved < 4000) return;
      R.dirty = false; R.saved = Date.now();
      var cv = document.createElement('canvas'); cv.width = cv.height = 512;
      cv.getContext('2d').putImageData(new ImageData(R.px, 512, 512), 0, 0);
      cv.toBlob(function (blob) {
        if (!blob || game !== g) return;
        idb().then(function (db) { db.transaction('rooms', 'readwrite').objectStore('rooms').put({ png: blob, dg: R.dg, m: 1 }, g + '/' + id); }).catch(function () {});
      }, 'image/png');
    });
  }
  function eachKey(store, g, fn, done) {
    idb().then(function (db) {
      var q = db.transaction(store, fn.write ? 'readwrite' : 'readonly').objectStore(store).openCursor();
      q.onsuccess = function () {
        var c = q.result;
        if (!c) { if (done) done(); return; }
        fn(c, String(c.key), String(c.key).indexOf(g + '/') === 0);
        c.continue();
      };
    }).catch(function () {});
  }
  function loadGame(g) {
    rooms = {}; game = g;
    Object.keys(full).forEach(function (id) { URL.revokeObjectURL(full[id].url); });
    full = {}; tried = {}; layouts = readLayouts();
    function each(c, k, mine) {
      if (!mine) return;
      // rooms kept before the magic meter was left out had it smeared over them
      // (when the screen scrolls): they're dropped and drawn again on the next visit
      if (!c.value || !c.value.m) { c.delete(); return; }
      var id = +k.slice(g.length + 1), v = c.value, img = new Image();
      img.onload = function () {
        if (game !== g) return;
        var cv = document.createElement('canvas'); cv.width = cv.height = 512;
        var cx = cv.getContext('2d'); cx.drawImage(img, 0, 0);
        var R = room(id, v.dg), d = cx.getImageData(0, 0, 512, 512).data;
        // keep what's been seen since, over what was saved
        for (var i = 0; i < d.length; i += 4) if (!R.px[i + 3] && d[i + 3]) { R.px[i] = d[i]; R.px[i + 1] = d[i + 1]; R.px[i + 2] = d[i + 2]; R.px[i + 3] = d[i + 3]; }
        R.changed++; paintAll();
        URL.revokeObjectURL(img.src);
      };
      img.src = URL.createObjectURL(v.png);
    }
    each.write = true;
    eachKey('rooms', g, each, paintAll);
    fullLoaded = false;
    eachKey('full', g, function (c, k, mine) {
      if (mine) full[+k.slice(g.length + 1)] = { url: URL.createObjectURL(c.value) };
    }, function () { if (game === g) { fullLoaded = true; paintAll(); } });
  }
  function clearGame() {
    var g = game;
    rooms = {};
    paintAll();
    if (!g) return;
    var del = function (c, k, mine) { if (mine) c.delete(); };
    del.write = true;
    eachKey('rooms', g, del);
  }

  // ── Full: building the rooms in a hidden emulator ─────────────────────────
  var fullLoaded = false, tried = {}, worker = null, building = null, queue = [];
  function needFull(dg) {
    if (mode() !== 'full' || !game || !fullLoaded || tried[dg] || dg < 0) return;
    if (building && building.dg === dg) return;
    if (queue.indexOf(dg) < 0) queue.push(dg);
    nextBuild();
  }
  function nextBuild() {
    if (building || !queue.length) return;
    var dg = queue.shift(), fl = floorsOf(dg);
    tried[dg] = true;
    if (!fl) { status[dg] = 'The dungeon layout couldn’t be read from this game.'; paintAll(); return; }
    var P = findPlayer(), core = P && P.core, rom = null;
    try { rom = core && core.rom().slice(); } catch (e) {}
    if (!rom || !rom.length) { status[dg] = 'Full maps are drawn from the game running in Rando Hub. Start the game first.'; paintAll(); return; }
    var jobs = DUNGEONS[dg][0].map(function (p) {
      var ids = [];
      layouts[p].forEach(function (f) { f.cells.forEach(function (id) { if (id !== 0x0F && !full[id] && ids.indexOf(id) < 0) ids.push(id); }); });
      return { key: p, entrance: PALACE[p].ent, rooms: ids };
    }).filter(function (j) { return j.rooms.length; });
    if (!jobs.length) { nextBuild(); return; }
    var g = game;
    // only this game's pictures are kept
    var del = function (c, k, mine) { if (!mine) c.delete(); };
    del.write = true;
    eachKey('full', g, del);
    building = { dg: dg, n: 0, total: 0 };
    status[dg] = 'Drawing ' + DUNGEONS[dg][2] + ' from the game…';
    paintAll();
    try { worker = new Worker(HERE + 'dgworker.js'); } catch (e) { building = null; status[dg] = 'This browser can’t draw full maps (no Web Workers).'; paintAll(); return; }
    var finish = function (msg) {
      try { worker.terminate(); } catch (e) {}
      worker = null; building = null; status[dg] = msg || '';
      paintAll(); nextBuild();
    };
    worker.onmessage = function (ev) {
      var m = ev.data;
      if (game !== g) { finish(); return; }
      if (m.px) {
        var cv = document.createElement('canvas'); cv.width = cv.height = 512;
        cv.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(m.px), 512, 512), 0, 0);
        cv.toBlob(function (blob) {
          if (!blob || game !== g) return;
          if (full[m.room]) URL.revokeObjectURL(full[m.room].url);
          full[m.room] = { url: URL.createObjectURL(blob) };
          idb().then(function (db) { db.transaction('full', 'readwrite').objectStore('full').put(blob, g + '/' + m.room); }).catch(function () {});
          paintAll();
        }, 'image/png');
      } else if (m.progress) {
        building.n = m.progress; building.total = m.total;
        status[dg] = 'Drawing ' + DUNGEONS[dg][2] + ' from the game… ' + m.progress + ' of ' + m.total + ' rooms';
        paintAll();
      } else if (m.done) finish('');
      else if (m.error) finish('Couldn’t draw the rooms: ' + m.error);
    };
    worker.onerror = function (e) { finish('Couldn’t draw the rooms: ' + (e.message || 'the worker stopped')); };
    worker.postMessage({ rom: rom.buffer, jobs: jobs }, [rom.buffer]);
  }
  var status = {};

  // ── the view ──────────────────────────────────────────────────────────────
  var LAB = 220, GAP = 192;   // floor name band, space between floors (room pixels)
  var views = [];
  function View(box) {
    this.box = box;
    this.inner = document.createElement('div'); this.inner.className = 'dg-inner';
    this.note = document.createElement('div'); this.note.className = 'dg-note';
    this.dot = document.createElement('div'); this.dot.className = 'dg-link';
    box.appendChild(this.inner); box.appendChild(this.note);
    this.dg = -1; this.zoom = 1; this.pan = [0, 0]; this.size = null; this.sig = '';
    this.els = {}; this.pos = {};
    var self = this;
    // wheel / pinch zoom, drag to move, double-click / double-tap to fit
    var pts = new Map(), pinch = null, drag = null, lastTap = 0;
    box.addEventListener('wheel', function (e) { e.preventDefault(); self.zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.25 : 0.8); }, { passive: false });
    box.addEventListener('dblclick', function () { self.fit(); });
    box.addEventListener('pointerdown', function (e) {
      if (e.isPrimary) { pts.clear(); pinch = null; drag = null; }
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      try { box.setPointerCapture(e.pointerId); } catch (x) {}
      if (pts.size === 2) { var a = Array.from(pts.values()); var d = Math.hypot(a[0][0] - a[1][0], a[0][1] - a[1][1]); pinch = d > 20 ? { d: d, z: self.zoom, c: [(a[0][0] + a[1][0]) / 2, (a[0][1] + a[1][1]) / 2] } : null; drag = null; }
      else drag = { x: e.clientX, y: e.clientY, p: self.pan.slice(), moved: false };
    });
    box.addEventListener('pointermove', function (e) {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pinch && pts.size === 2) {
        var a = Array.from(pts.values()), d = Math.hypot(a[0][0] - a[1][0], a[0][1] - a[1][1]);
        self.setZoomAt(pinch.c[0], pinch.c[1], Math.max(0.02, Math.min(2.5, pinch.z * d / pinch.d)));
      } else if (drag) {
        if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > 3) drag.moved = true;
        self.pan = [drag.p[0] + e.clientX - drag.x, drag.p[1] + e.clientY - drag.y]; self.userMoved = true; self.apply();
      }
    });
    function up(e) {
      pts.delete(e.pointerId); if (pts.size < 2) pinch = null;
      if (!pts.size) {
        if (e.pointerType === 'touch' && drag && !drag.moved) { var now = Date.now(); if (now - lastTap < 300) { self.fit(); lastTap = 0; } else lastTap = now; }
        drag = null;
      }
    }
    box.addEventListener('pointerup', up); box.addEventListener('pointercancel', up);
    box.style.touchAction = 'none';
    views.push(this);
  }
  View.prototype.show = function (dg) {
    this.dg = dg; this.sig = ''; this.userMoved = false;
    this.paint(true);
    this.fit();
  };
  // Which floors (and loose rooms) to draw, and where each room goes.
  View.prototype.plan = function (md) {
    var dg = this.dg, fl = floorsOf(dg), blocks = [], placed = {};
    if (fl) fl.floors.forEach(function (f) {
      var cells = [];
      f.cells.forEach(function (id, k) {
        if (id === 0x0F) return;
        var c = k % 5 - f.c0, r = ((k / 5) | 0) - f.r0;
        cells.push([id, c, r]); placed[id] = 1;
      });
      if (md === 'explore' && !cells.some(function (x) { return rooms[x[0]] && rooms[x[0]].dg === dg; })) return;
      blocks.push({ label: f.label, cw: f.cw, ch: f.ch, cells: cells });
    });
    // explore: only what's been seen, cropped to it (the rest of the dungeon stays a secret)
    if (md === 'explore' && blocks.length) {
      var seen = function (c) { return rooms[c[0]] && rooms[c[0]].dg === dg; }, c0 = 9, r0 = 9, c1 = -1, r1 = -1;
      blocks.forEach(function (b) {
        b.cells = b.cells.filter(seen);
        b.cells.forEach(function (c) { c0 = Math.min(c0, c[1]); c1 = Math.max(c1, c[1]); r0 = Math.min(r0, c[2]); r1 = Math.max(r1, c[2]); });
      });
      blocks.forEach(function (b) {
        b.cells = b.cells.map(function (c) { return [c[0], c[1] - c0, c[2] - r0]; });
        b.cw = c1 - c0 + 1; b.ch = r1 - r0 + 1;
      });
    }
    // explored rooms the pause map doesn't list (or no layout): their own block
    if (md === 'explore') {
      var loose = Object.keys(rooms).map(Number).filter(function (id) { return rooms[id].dg === dg && !placed[id]; }).sort(function (a, b) { return a - b; });
      if (loose.length) {
        var w = Math.ceil(Math.sqrt(loose.length));
        blocks.push({ label: fl ? 'Other rooms' : '', cw: w, ch: Math.ceil(loose.length / w), cells: loose.map(function (id, i) { return [id, i % w, (i / w) | 0]; }) });
      }
    }
    return blocks;
  };
  View.prototype.layout = function (blocks) {
    // as many floors across as fit the box best
    var W = this.box.clientWidth || 300, H = this.box.clientHeight || 300, n = blocks.length, best = null;
    var bw = 0, bh = 0;
    blocks.forEach(function (b) { bw = Math.max(bw, b.cw * 512); bh = Math.max(bh, b.ch * 512 + (b.label ? LAB : 0)); });
    for (var cols = 1; cols <= Math.max(1, n); cols++) {
      var rows = Math.ceil(n / cols), w = cols * bw + (cols - 1) * GAP, h = rows * bh + (rows - 1) * GAP, z = Math.min(W / w, H / h);
      if (!best || z > best.z) best = { cols: cols, z: z, w: w, h: h };
    }
    return { cols: best ? best.cols : 1, bw: bw, bh: bh, w: best ? best.w : 0, h: best ? best.h : 0 };
  };
  View.prototype.paint = function (force) {
    var dg = this.dg, self = this, md = mode();
    if (dg < 0) return;
    if (md === 'full') needFull(dg);
    var blocks = this.plan(md), L = this.layout(blocks);
    var sig = [md, dg, L.cols, blocks.map(function (b) { return b.label + ':' + b.cells.map(function (c) { return c[0]; }).join(','); }).join('|')].join('/');
    if (sig !== this.sig || force) {
      this.sig = sig; this.inner.textContent = ''; this.els = {}; this.pos = {};
      blocks.forEach(function (b, i) {
        var bx = (i % L.cols) * (L.bw + GAP), by = ((i / L.cols) | 0) * (L.bh + GAP), top = by + (b.label ? LAB : 0);
        if (b.label) {
          var lb = document.createElement('div'); lb.className = 'dg-floor'; lb.textContent = b.label;
          lb.style.left = bx + 'px'; lb.style.top = by + 'px'; self.inner.appendChild(lb);
        }
        b.cells.forEach(function (c) {
          var x = bx + c[1] * 512, y = top + c[2] * 512, e;
          if (md === 'map') {
            e = document.createElement('div'); e.className = 'dg-cell';
            var sk = document.createElement('span'); sk.className = 'dg-skull'; sk.textContent = '☠'; e.appendChild(sk);
          } else if (md === 'full') { e = document.createElement('img'); e.className = 'dg-room'; e.alt = ''; e.draggable = false; }
          else { e = document.createElement('canvas'); e.width = e.height = 512; e.className = 'dg-room'; e.__painted = 0; }
          e.style.left = x + 'px'; e.style.top = y + 'px';
          self.inner.appendChild(e);
          if (!self.els[c[0]]) { self.els[c[0]] = e; self.pos[c[0]] = [x, y]; }
        });
      });
      this.inner.appendChild(this.dot);
      this.inner.style.width = L.w + 'px'; this.inner.style.height = L.h + 'px';
      this.size = L.w && L.h ? [L.w, L.h] : null;
      if (!this.userMoved) this.fit();
    }
    // the rooms
    var pal = DUNGEONS[dg][0], hasMap = pal.some(function (p) { return dgItems.map & (0x8000 >> p); }),
      hasCompass = pal.some(function (p) { return dgItems.compass & (0x8000 >> p); });
    var bosses = pal.map(function (p) { return PALACE[p].boss; });
    Object.keys(this.els).forEach(function (k) {
      var id = +k, e = self.els[k];
      if (md === 'explore') {
        var R = rooms[id];
        e.style.visibility = R ? '' : 'hidden';
        if (R && (e.__painted !== R.changed || force)) { e.getContext('2d').putImageData(new ImageData(R.px, 512, 512), 0, 0); e.__painted = R.changed; }
      } else if (md === 'full') {
        var F = full[id], u = F ? F.url : '';
        if (e.__src !== u) { e.__src = u; if (u) e.src = u; else e.removeAttribute('src'); e.style.visibility = u ? '' : 'hidden'; }
      } else {
        var v = visited(id), boss = bosses.indexOf(id) >= 0;
        e.classList.toggle('seen', v);
        e.classList.toggle('known', !v && hasMap);
        e.classList.toggle('boss', boss && (hasCompass || v));
        e.classList.toggle('here', where.dg === dg && where.room === id);
      }
    });
    // what's going on
    var msg = '';
    if (md === 'explore' && !blocks.length) msg = DUNGEONS[dg][2] + ': nothing explored yet. The rooms you walk through appear here.';
    else if (md !== 'explore' && !layouts) msg = 'Start the game to see the dungeon maps (they’re read from the game).';
    else if (md === 'full' && status[dg]) msg = status[dg];
    this.note.textContent = msg;
    this.note.style.display = msg ? '' : 'none';
    this.note.classList.toggle('top', !!blocks.length);
    // Link
    var p = where.dg === dg && this.pos[where.room];
    this.dot.style.display = p ? '' : 'none';
    if (p) { this.dot.style.left = (p[0] + (where.x & 511)) + 'px'; this.dot.style.top = (p[1] + (where.y & 511)) + 'px'; }
  };
  View.prototype.fit = function () {
    this.userMoved = false;
    var W = this.box.clientWidth, H = this.box.clientHeight, s = this.size;
    if (!s || !W || !H) { this.zoom = 1; this.pan = [0, 0]; this.apply(); return; }
    this.zoom = Math.min(W / s[0], H / s[1]) * 0.96;
    this.pan = [(W - s[0] * this.zoom) / 2, (H - s[1] * this.zoom) / 2];
    this.apply();
  };
  View.prototype.apply = function () {
    this.inner.style.transform = 'translate(' + this.pan[0] + 'px,' + this.pan[1] + 'px) scale(' + this.zoom + ')';
    this.inner.classList.toggle('sharp', this.zoom >= 1);
    this.dot.style.transform = 'translate(-50%,-50%) scale(' + (1 / this.zoom) + ')';
  };
  View.prototype.zoomAt = function (cx, cy, f) { this.setZoomAt(cx, cy, Math.max(0.02, Math.min(2.5, this.zoom * f))); };
  View.prototype.setZoomAt = function (cx, cy, z) {
    var r = this.box.getBoundingClientRect(), x = cx - r.left, y = cy - r.top;
    this.pan = [x - (x - this.pan[0]) * z / this.zoom, y - (y - this.pan[1]) * z / this.zoom];
    this.zoom = z; this.userMoved = true; this.apply();
  };
  function paintAll() {
    views = views.filter(function (v) { return v.box.isConnected; });
    views.forEach(function (v) { if (v.box.style.display !== 'none') v.paint(false); });
  }

  // ── running ───────────────────────────────────────────────────────────────
  var Dg = window.EmoDungeons = {
    list: DUNGEONS,
    View: View,
    where: function () { return where; },
    explored: function (dg) { return Object.keys(rooms).some(function (id) { return rooms[id].dg === dg; }); },
    clear: clearGame,
    onEnter: null,
    mode: mode,
    pref: function () { return pref; },
    setMode: function (m) {
      if (['explore', 'map', 'full'].indexOf(m) < 0) return;
      pref = m;
      try { localStorage.setItem(MODE_KEY, m); } catch (e) {}
      views.forEach(function (v) { v.sig = ''; v.userMoved = false; });
      paintAll();
    },
  };
  setInterval(function () {
    var g = E.game;
    if (g && g !== 'nogame' && g !== game) loadGame(g);
    if (!game) return;
    if (!layouts) layouts = readLayouts();
    try { capture(); } catch (e) {}
    paintAll();
  }, 250);
  setInterval(saveDirty, 2000);
  window.addEventListener('pagehide', function () { Object.keys(rooms).forEach(function (id) { rooms[id].saved = 0; }); saveDirty(); });
})();
