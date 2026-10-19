/*
 * dungeons.js — dungeon maps for the EmoTracker page.
 *
 * "Explore" (fog of war): each dungeon room is captured from the game's own
 * picture as you walk through it, and the rooms are laid out where the game
 * keeps them (room 0x12 sits right of 0x11 and below 0x02), so the dungeon
 * fills in as you explore. Kept per game in the browser (IndexedDB).
 *
 * Above the maps: World and a button per dungeon. Entering a dungeon shows its
 * map; leaving shows the world again (unless you picked one by hand).
 *
 * What it reads (WRAM): $10 module (7 = indoors), $11 submodule (0 = playing),
 * $1B indoors, $13 screen brightness, $A0 room, $040C dungeon, $E2/$E8 BG2
 * scroll (where the camera is, in the underworld's coordinates: each room is
 * 512 x 512, room x = id & 15, y = id >> 4), $20/$22 Link.
 */
(function () {
  'use strict';
  var E = window.EmoWeb;
  var DUNGEONS = [
    // [$040C >> 1 values, short name, full name]
    [[0, 1], 'HC', 'Hyrule Castle'], [[2], 'EP', 'Eastern Palace'], [[3], 'DP', 'Desert Palace'],
    [[10], 'ToH', 'Tower of Hera'], [[4], 'AT', "Agahnim's Tower"], [[6], 'PoD', 'Palace of Darkness'],
    [[5], 'SP', 'Swamp Palace'], [[8], 'SW', 'Skull Woods'], [[11], 'TT', "Thieves' Town"],
    [[9], 'IP', 'Ice Palace'], [[7], 'MM', 'Misery Mire'], [[12], 'TR', 'Turtle Rock'], [[13], 'GT', "Ganon's Tower"]];
  function dgOf(code) {
    for (var i = 0; i < DUNGEONS.length; i++) if (DUNGEONS[i][0].indexOf(code) >= 0) return i;
    return -1;
  }

  // ── captured rooms ────────────────────────────────────────────────────────
  var rooms = {};        // room id → { px: Uint8ClampedArray(512*512*4), dg, dirty, cv }
  var game = null;
  function room(id, dg) {
    var r = rooms[id];
    if (!r) { r = rooms[id] = { px: new Uint8ClampedArray(512 * 512 * 4), dg: dg, dirty: false, saved: 0, cv: null, painted: 0, changed: 1 }; }
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
  function wram(addr, len) {
    var b = E.bridge && E.bridge();
    if (!b || !b.ready()) return null;
    try { return b.read(0xF50000 + addr, len); } catch (e) { return null; }
  }

  var where = { indoors: false, dg: -1, room: -1, x: 0, y: 0 };
  var HUD = 40;   // the top lines show the HUD over the room
  function capture() {
    var m = wram(0x10, 2), b1b = wram(0x1B, 1), bri = wram(0x13, 1), r = wram(0xA0, 2), d = wram(0x40C, 1),
      sx = wram(0xE2, 2), sy = wram(0xE8, 2), lk = wram(0x20, 4);
    if (!m || !r || !d || !sx || !sy) return;
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
        var wx = camX + x; if ((wx >> 9) !== rx) continue;
        var c = f.data[y * f.w + x * step], q = (ly * 512 + (wx & 511)) * 4;
        var r5 = c >> 11, g6 = (c >> 5) & 63, b5 = c & 31;
        px[q] = r5 << 3 | r5 >> 2; px[q + 1] = g6 << 2 | g6 >> 4; px[q + 2] = b5 << 3 | b5 >> 2; px[q + 3] = 255;
        n++;
      }
    }
    if (n) { R.dirty = true; R.changed++; }
  }

  // ── keeping them (per game) ───────────────────────────────────────────────
  function idb() {
    return new Promise(function (res, rej) {
      var q = indexedDB.open('rhb-emo-dungeons', 1);
      q.onupgradeneeded = function () { q.result.createObjectStore('rooms'); };
      q.onsuccess = function () { res(q.result); }; q.onerror = function () { rej(q.error); };
    });
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
        idb().then(function (db) { db.transaction('rooms', 'readwrite').objectStore('rooms').put({ png: blob, dg: R.dg }, g + '/' + id); }).catch(function () {});
      }, 'image/png');
    });
  }
  function loadGame(g) {
    rooms = {}; game = g;
    idb().then(function (db) {
      var st = db.transaction('rooms').objectStore('rooms'), q = st.openCursor();
      q.onsuccess = function () {
        var c = q.result;
        if (!c) { paintAll(); return; }
        var k = String(c.key);
        if (k.indexOf(g + '/') === 0) {
          var id = +k.slice(g.length + 1), v = c.value;
          var img = new Image();
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
        c.continue();
      };
    }).catch(function () {});
  }
  function clearGame() {
    var g = game;
    rooms = {};
    paintAll();
    if (!g) return;
    idb().then(function (db) {
      var st = db.transaction('rooms', 'readwrite').objectStore('rooms'), q = st.openCursor();
      q.onsuccess = function () { var c = q.result; if (!c) return; if (String(c.key).indexOf(g + '/') === 0) c.delete(); c.continue(); };
    }).catch(function () {});
  }

  // ── the view ──────────────────────────────────────────────────────────────
  var views = [];
  function View(box) {
    this.box = box;
    this.inner = document.createElement('div'); this.inner.className = 'dg-inner';
    this.note = document.createElement('div'); this.note.className = 'dg-note';
    this.dot = document.createElement('div'); this.dot.className = 'dg-link';
    box.appendChild(this.inner); box.appendChild(this.note);
    this.cvs = {}; this.dg = -1; this.zoom = 1; this.pan = [0, 0]; this.bb = null;
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
        self.setZoomAt(pinch.c[0], pinch.c[1], Math.max(0.2, Math.min(20, pinch.z * d / pinch.d)));
      } else if (drag) {
        if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > 3) drag.moved = true;
        self.pan = [drag.p[0] + e.clientX - drag.x, drag.p[1] + e.clientY - drag.y]; self.apply();
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
    this.dg = dg; this.inner.textContent = ''; this.cvs = {}; this.bb = null;
    this.inner.appendChild(this.dot);
    this.paint(true);
    this.fit();
  };
  View.prototype.paint = function (force) {
    var dg = this.dg, self = this;
    if (dg < 0) return;
    var ids = Object.keys(rooms).map(Number).filter(function (id) { return rooms[id].dg === dg; });
    if (!ids.length) {
      this.note.textContent = DUNGEONS[dg][2] + ': nothing explored yet. The rooms you walk through appear here.';
      this.note.style.display = '';
    } else this.note.style.display = 'none';
    var x0 = 99, y0 = 99, x1 = -1, y1 = -1;
    ids.forEach(function (id) { var x = id & 15, y = id >> 4; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); });
    var bb = ids.length ? [x0, y0, x1, y1] : null, bbChanged = JSON.stringify(bb) !== JSON.stringify(this.bb);
    this.bb = bb;
    ids.forEach(function (id) {
      var R = rooms[id], cv = self.cvs[id];
      if (!cv) {
        cv = self.cvs[id] = document.createElement('canvas'); cv.width = cv.height = 512; cv.className = 'dg-room';
        cv.__painted = 0; self.inner.insertBefore(cv, self.dot);
      }
      if (bb) { cv.style.left = ((id & 15) - bb[0]) * 512 + 'px'; cv.style.top = ((id >> 4) - bb[1]) * 512 + 'px'; }
      if (cv.__painted !== R.changed || force) { cv.getContext('2d').putImageData(new ImageData(R.px, 512, 512), 0, 0); cv.__painted = R.changed; }
    });
    if (bb) { this.inner.style.width = (bb[2] - bb[0] + 1) * 512 + 'px'; this.inner.style.height = (bb[3] - bb[1] + 1) * 512 + 'px'; }
    // Link
    var here = where.dg === dg && bb;
    this.dot.style.display = here ? '' : 'none';
    if (here) { this.dot.style.left = (where.x - bb[0] * 512) + 'px'; this.dot.style.top = (where.y - bb[1] * 512) + 'px'; }
    if (bbChanged && !this.userMoved) this.fit();
  };
  View.prototype.fit = function () {
    this.userMoved = false;
    var W = this.box.clientWidth, H = this.box.clientHeight, bb = this.bb;
    if (!bb || !W || !H) { this.zoom = 1; this.pan = [0, 0]; this.apply(); return; }
    var w = (bb[2] - bb[0] + 1) * 512, h = (bb[3] - bb[1] + 1) * 512;
    this.zoom = Math.min(W / w, H / h) * 0.96;
    this.pan = [(W - w * this.zoom) / 2, (H - h * this.zoom) / 2];
    this.apply();
  };
  View.prototype.apply = function () {
    this.inner.style.transform = 'translate(' + this.pan[0] + 'px,' + this.pan[1] + 'px) scale(' + this.zoom + ')';
    this.inner.classList.toggle('sharp', this.zoom >= 1);
    this.dot.style.transform = 'translate(-50%,-50%) scale(' + (1 / this.zoom) + ')';
  };
  View.prototype.zoomAt = function (cx, cy, f) { this.setZoomAt(cx, cy, Math.max(0.05, Math.min(20, this.zoom * f))); };
  View.prototype.setZoomAt = function (cx, cy, z) {
    var r = this.box.getBoundingClientRect(), x = cx - r.left, y = cy - r.top;
    this.pan = [x - (x - this.pan[0]) * z / this.zoom, y - (y - this.pan[1]) * z / this.zoom];
    this.zoom = z; this.userMoved = true; this.apply();
  };
  function paintAll() { views = views.filter(function (v) { return v.box.isConnected; }); views.forEach(function (v) { v.paint(false); }); }

  // ── running ───────────────────────────────────────────────────────────────
  var Dg = window.EmoDungeons = {
    list: DUNGEONS,
    View: View,
    where: function () { return where; },
    explored: function (dg) { return Object.keys(rooms).some(function (id) { return rooms[id].dg === dg; }); },
    clear: clearGame,
    onEnter: null,
  };
  setInterval(function () {
    var g = E.game;
    if (g && g !== 'nogame' && g !== game) loadGame(g);
    if (!game) return;
    try { capture(); } catch (e) {}
    paintAll();
  }, 250);
  setInterval(saveDirty, 2000);
  window.addEventListener('pagehide', function () { Object.keys(rooms).forEach(function (id) { rooms[id].saved = 0; }); saveDirty(); });
})();
