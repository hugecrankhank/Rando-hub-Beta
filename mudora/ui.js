/*
 * ui.js — what Mudora shows: items, dungeons, the two worlds with their
 * checks, dungeon maps, counters. Everything comes from window.Mudora
 * (mudora.js): Hutch's logic, and pictures from the game itself.
 */
(function () {
  'use strict';
  var M = window.Mudora, D = window.EmoDungeons;
  var $ = function (id) { return document.getElementById(id); };
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  var COLOR_WORD = { green: 'Available', partial: 'Some available', yellow: 'Possible', orange: 'Visible (can see it, can’t get it yet)', purple: 'Out of logic (a trick gets it)', red: 'Not yet', done: 'Done' };
  var CSS = { green: 'var(--c-green)', partial: 'var(--c-partial, #0b7a3a)', yellow: 'var(--c-yellow)', orange: 'var(--c-orange)', purple: 'var(--c-purple)', red: 'var(--c-red)', done: '#2a2d30' };
  var LOGIC = M.logicName || 'Hutch’s';   // whose logic, in messages
  var touch = window.matchMedia && matchMedia('(pointer: coarse)').matches;

  // ── items ─────────────────────────────────────────────────────────────────
  // like the game's own menu: Y items, then equipment
  var ITEMS = ['bow', 'boomerang', 'hookshot', 'bomb', 'mushroom', 'powder',
    'firerod', 'icerod', 'bombos', 'ether', 'quake', 'lamp',
    'hammer', 'shovel', 'flute', 'net', 'book', 'somaria',
    'byrna', 'cape', 'mirror', 'boots', 'gloves', 'flippers',
    'moonpearl', 'sword', 'shield', 'tunic', 'halfmagic', 'agahnim',
    'bottle1', 'bottle2', 'bottle3', 'bottle4'];
  var SINGLE = { hookshot: 1, bomb: 1, powder: 1, firerod: 1, icerod: 1, bombos: 1, ether: 1, quake: 1, lamp: 1, hammer: 1, shovel: 1, net: 1,
    book: 1, somaria: 1, byrna: 1, cape: 1, mirror: 1, boots: 1, flippers: 1, moonpearl: 1 };
  var NAMES = { bow: 'Bow', boomerang: 'Boomerang', hookshot: 'Hookshot', bomb: 'Bombs', mushroom: 'Mushroom', powder: 'Magic Powder',
    firerod: 'Fire Rod', icerod: 'Ice Rod', bombos: 'Bombos', ether: 'Ether', quake: 'Quake', lamp: 'Lamp', hammer: 'Hammer', shovel: 'Shovel',
    flute: 'Flute', net: 'Bug Net', book: 'Book of Mudora', somaria: 'Cane of Somaria', byrna: 'Cane of Byrna', cape: 'Magic Cape',
    mirror: 'Magic Mirror', boots: 'Pegasus Boots', gloves: 'Gloves', flippers: 'Flippers', moonpearl: 'Moon Pearl', sword: 'Sword',
    shield: 'Shield', tunic: 'Mail', halfmagic: 'Half Magic', agahnim: 'Agahnim', bottle1: 'Bottle', bottle2: 'Bottle', bottle3: 'Bottle', bottle4: 'Bottle' };
  // the picture for an item at a state: [icon keys], dim
  function look(key, s) {
    var I = M.icons;
    s = s || 0;
    if (SINGLE[key]) return { ic: [key], off: !s };
    switch (key) {
      case 'bow': return { ic: ['bow' + (s || 2)], off: !s };
      case 'boomerang': return { ic: s === 3 ? ['boomerang1', 'boomerang2'] : ['boomerang' + (s === 2 ? 2 : 1)], off: !s };
      case 'mushroom': return { ic: ['mushroom'], off: !s, lbl: s === 2 ? '✓' : '' };
      case 'flute': return { ic: ['flute'], off: !s, lbl: s === 2 ? 'bird' : '' };
      case 'gloves': return { ic: ['gloves' + (s || 1)], off: !s };
      case 'sword': return { ic: ['sword' + (s || 1)], off: !s };
      case 'shield': return { ic: ['shield' + (s || 1)], off: !s };
      case 'tunic': return { ic: ['tunic' + Math.min(2, s)], off: false };
      case 'halfmagic': return { tx: '½', off: !s };
      case 'agahnim': return { tx: s ? '☠' : 'A', off: !s, title: s ? 'Agahnim defeated' : 'Agahnim' };
      default:
        if (/^bottle/.test(key)) return { ic: ['bottle' + (s || 1)], off: !s };
    }
    return { ic: [key], off: !s };
  }
  M.look = look;
  function iconImg(k) { var u = M.icons[k]; if (!u) return null; var i = new Image(); i.src = u; i.alt = ''; i.draggable = false; return i; }
  var itemEls = {};
  function buildItems() {
    var box = $('items'); box.textContent = '';
    ITEMS.forEach(function (key) {
      var b = el('div', 'it'); b.dataset.key = key; b.title = NAMES[key] || key;
      b.addEventListener('click', function (e) { e.preventDefault(); if (!M.stepItem(key, 1)) M.toast(LOGIC + ' tracker isn’t running yet.'); });
      b.addEventListener('contextmenu', function (e) {
        e.preventDefault();
        if (key === 'bombos' || key === 'ether' || key === 'quake') M.medallion(key);
        else M.stepItem(key, -1);
      });
      longPress(b, function () { b.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })); });
      box.appendChild(b); itemEls[key] = b;
    });
    paintItems();
  }
  function itemState(key) {
    var it = M.items || {};
    var v = it[key];
    return typeof v === 'number' ? v : 0;
  }
  function paintItems() {
    var it = M.items || {};
    ITEMS.forEach(function (key) {
      var b = itemEls[key]; if (!b) return;
      var s = itemState(key), L = look(key, s);
      var sig = JSON.stringify([L, M.iconState, medLabel(key)]);
      if (b.__sig === sig) return;
      b.__sig = sig; b.textContent = '';
      b.classList.toggle('off', !!L.off);
      b.classList.toggle('two', !!(L.ic && L.ic.length > 1));
      var drew = false;
      (L.ic || []).forEach(function (k) { var i = iconImg(k); if (i) { b.appendChild(i); drew = true; } });
      if (!drew) b.appendChild(el('span', 'tx', L.tx || (NAMES[key] || key).slice(0, 2)));
      var ml = medLabel(key) || L.lbl;
      if (ml) b.appendChild(el('span', 'lbl', ml));
      if (L.title) b.title = L.title;
    });
  }
  function medLabel(key) {
    var it = M.items || {};
    if (key !== 'bombos' && key !== 'ether' && key !== 'quake') return '';
    var n = { bombos: 1, ether: 2, quake: 3 }[key], out = [];
    if (it.mmMedallion === n) out.push('MM');
    if (it.trMedallion === n) out.push('TR');
    return out.join(' ');
  }

  // ── dungeons ──────────────────────────────────────────────────────────────
  var DGS = [['hc', 'HC', 'Hyrule Castle'], ['ep', 'EP', 'Eastern Palace'], ['dp', 'DP', 'Desert Palace'], ['toh', 'ToH', 'Tower of Hera'],
    ['ct', 'AT', 'Agahnim’s Tower'], ['pod', 'PoD', 'Palace of Darkness'], ['sp', 'SP', 'Swamp Palace'], ['sw', 'SW', 'Skull Woods'],
    ['tt', 'TT', 'Thieves’ Town'], ['ip', 'IP', 'Ice Palace'], ['mm', 'MM', 'Misery Mire'], ['tr', 'TR', 'Turtle Rock'], ['gt', 'GT', 'Ganon’s Tower']];
  // dungeons.js's list order, by short name
  function dgIndex(short) { if (!D) return -1; for (var i = 0; i < D.list.length; i++) if (D.list[i][1] === short) return i; return -1; }
  var dgEls = {};
  function buildDungeons() {
    var box = $('dungeons'); box.textContent = '';
    DGS.forEach(function (d) {
      var k = d[0], r = el('div', 'dg'); r.title = d[2] + '\nClick: open its map. Chests, keys and items: click to count, right click to undo.';
      var nm = el('span', 'nm', d[1]), pz = el('span', 'pz'), mid = el('span', 'row'), end = el('span', 'row');
      var chest = el('span', 'n'), key = el('span', 'key'), bk = el('img', 'ic'), mp = el('img', 'ic'), cp = el('img', 'ic');
      [bk, mp, cp].forEach(function (i) { i.alt = ''; i.draggable = false; });
      mid.appendChild(bk); mid.appendChild(mp); mid.appendChild(cp); mid.appendChild(key);
      end.appendChild(chest);
      r.appendChild(nm); r.appendChild(pz); r.appendChild(mid); r.appendChild(end);
      function act(part) {
        return function (e) { e.stopPropagation(); e.preventDefault(); M.dungeonAct(k, part, e.type === 'contextmenu' ? -1 : 1); };
      }
      [[chest, 'chest'], [key, 'key'], [bk, 'bigkey'], [mp, 'map'], [cp, 'compass'], [pz, 'prize']].forEach(function (p) {
        p[0].style.cursor = 'pointer';
        p[0].addEventListener('click', act(p[1])); p[0].addEventListener('contextmenu', act(p[1]));
      });
      r.addEventListener('click', function () { var i = dgIndex(d[1]); if (i >= 0) selectDg(i); });
      box.appendChild(r);
      dgEls[k] = { r: r, pz: pz, chest: chest, key: key, bk: bk, mp: mp, cp: cp };
    });
    paintDungeons();
  }
  function prizeIcon(name) {
    return { crystal: 'crystal', redcrystal: 'crystal_red', pendant: 'pendant_blue', greenpendant: 'pendant_green', unknown: '' }[name] || '';
  }
  function setImg(img, k) { var u = k && M.icons[k]; if (u) { if (img.getAttribute('src') !== u) img.src = u; img.style.visibility = ''; } else img.style.visibility = 'hidden'; }
  function paintDungeons() {
    var it = M.items || {};
    DGS.forEach(function (d) {
      var k = d[0], E = dgEls[k]; if (!E) return;
      var col = M.dcolors[k] || 'red', done = M.dcleared[k];
      E.r.className = 'dg ' + (done ? 'done' : col);
      var max = it[k + 'MaxChests'], got = it[k + 'Chests'];
      var left = max === '?' ? '?' : Math.max(0, (max || 0) - (got || 0));
      E.chest.textContent = max != null ? left : '';
      E.chest.className = 'n' + (left === 0 ? ' zero' : '');
      E.chest.title = max != null ? 'Chests left: ' + left + ' (' + (got || 0) + ' of ' + max + ' found)' : '';
      var km = it[k + 'MaxSmallKeys'] != null ? it[k + 'MaxSmallKeys'] : it[k + 'SmallKeysMax'];
      E.key.textContent = km ? '🗝' + (it[k + 'SmallKeys'] || 0) + '/' + km : '';
      E.key.title = km ? 'Small keys: ' + (it[k + 'SmallKeys'] || 0) + ' of ' + km : '';
      setImg(E.bk, 'bigkey'); E.bk.classList.toggle('off', !it[k + 'BigKey']);
      setImg(E.mp, 'map'); E.mp.classList.toggle('off', !it[k + 'Map']);
      setImg(E.cp, 'compass'); E.cp.classList.toggle('off', !it[k + 'Compass']);
      var pn = it[k + 'Prize'];
      E.mp.style.display = E.cp.style.display = k === 'ct' ? 'none' : '';
      var pk = k === 'hc' || k === 'ct' || k === 'gt' ? null : prizeIcon(pn);
      var psig = [pk, M.icons[pk] ? 1 : 0, !!it[k + 'PrizeObtained']].join();
      if (E.pz.__sig !== psig) {
        E.pz.__sig = psig; E.pz.textContent = '';
        if (pk && M.icons[pk]) { var pi = iconImg(pk); if (!it[k + 'PrizeObtained']) pi.style.filter = 'grayscale(1) brightness(.45)'; E.pz.appendChild(pi); }
        else if (pk === '') E.pz.textContent = '?';
      }
      E.pz.title = pn ? pn.replace('green', 'green ').replace('red', 'red ') : '';
    });
  }

  // ── long press (phones): the same as a right click ────────────────────────
  function longPress(node, fn) {
    var t = null, sx = 0, sy = 0;
    node.addEventListener('touchstart', function (e) { var p = e.touches[0]; sx = p.clientX; sy = p.clientY; t = setTimeout(function () { t = 'done'; fn(); }, 480); }, { passive: true });
    node.addEventListener('touchmove', function (e) { var p = e.touches[0]; if (t && t !== 'done' && Math.abs(p.clientX - sx) + Math.abs(p.clientY - sy) > 10) { clearTimeout(t); t = null; } }, { passive: true });
    node.addEventListener('touchend', function (e) { if (t === 'done') e.preventDefault(); else clearTimeout(t); t = null; });
  }

  // ── the two worlds ────────────────────────────────────────────────────────
  var views = [];
  // Drawn on a canvas the size of the box, not as one huge zoomed picture:
  // zooming a 4096-pixel world as a page element made iPhone Safari build a
  // picture many times the screen and run out of memory. Fully zoomed out it
  // draws a small copy of the world (1024 x 1024, made once); zoomed in, only
  // the screens in view at full size (a handful kept, the rest let go).
  function WorldView(world) {
    var self = this;
    this.world = world;
    this.box = el('div', 'wv');
    this.cv = el('canvas', 'wcv'); this.cx = this.cv.getContext('2d');
    this.pins = el('div', 'pins');
    this.box.appendChild(this.cv); this.box.appendChild(this.pins);
    this.box.appendChild(el('div', 'wname', world === 'lw' ? 'Light World' : 'Dark World'));
    var rs = el('button', 'wreset', '⟲'); rs.type = 'button'; rs.title = 'Reset this map (whole world, as at the start)';
    rs.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
    rs.addEventListener('click', function (e) { e.stopPropagation(); self.fit(); });
    this.box.appendChild(rs);
    this.zoom = 0.1; this.pan = [0, 0]; this.userMoved = false; this.pinEls = {};
    this.small = null; this.full = {}; this.used = []; this.raf = 0;
    // wheel / pinch zoom, drag to move, double-click / double-tap to fit
    var pts = new Map(), pinch = null, drag = null, lastTap = 0, box = this.box;
    box.addEventListener('wheel', function (e) { e.preventDefault(); self.zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.2 : 1 / 1.2); }, { passive: false });
    box.addEventListener('dblclick', function (e) { if (!e.target.closest('.pin')) self.fit(); });
    box.addEventListener('pointerdown', function (e) {
      if (e.isPrimary) { pts.clear(); pinch = null; drag = null; }
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (e.pointerType === 'touch' && !e.target.closest('.pin')) { try { box.setPointerCapture(e.pointerId); } catch (x) {} }
      if (pts.size === 2) { var a = Array.from(pts.values()), d = Math.hypot(a[0][0] - a[1][0], a[0][1] - a[1][1]); pinch = d > 20 ? { d: d, z: self.zoom, c: [(a[0][0] + a[1][0]) / 2, (a[0][1] + a[1][1]) / 2] } : null; drag = null; }
      else drag = { x: e.clientX, y: e.clientY, p: self.pan.slice(), moved: false };
    });
    box.addEventListener('pointermove', function (e) {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pinch && pts.size === 2) {
        var a = Array.from(pts.values()), d = Math.hypot(a[0][0] - a[1][0], a[0][1] - a[1][1]);
        self.setZoomAt(pinch.c[0], pinch.c[1], self.clampZ(pinch.z * Math.max(0.25, Math.min(4, d / pinch.d))));
      } else if (drag) {
        if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > 4) drag.moved = true;
        if (drag.moved) { self.pan = [drag.p[0] + e.clientX - drag.x, drag.p[1] + e.clientY - drag.y]; self.userMoved = true; self.apply(); }
      }
    });
    function upEv(e) {
      pts.delete(e.pointerId); if (pts.size < 2) pinch = null;
      if (!pts.size) {
        if (e.pointerType === 'touch' && drag && !drag.moved && !e.target.closest('.pin')) {
          var now = Date.now(); if (now - lastTap < 300) { self.fit(); lastTap = 0; } else lastTap = now;
        }
        drag = null;
      }
    }
    box.addEventListener('pointerup', upEv); box.addEventListener('pointercancel', upEv);
    views.push(this);
    this.paintTiles();
  }
  WorldView.prototype.clampZ = function (z) { var f = this.fitZ || 0.05; return Math.max(f * 0.8, Math.min(3, z)); };
  WorldView.prototype.maps = function () { return M.romMaps && M.romMaps[this.world === 'lw' ? 'light' : 'dark']; };
  // a new game's pictures: make the small copy, one screen at a time
  WorldView.prototype.paintTiles = function () {
    var maps = this.maps(), key = maps ? maps[0] : 'none', self = this;
    if (this.__tiles === key) return;
    this.__tiles = key; this.small = null; this.full = {}; this.used = [];
    if (!maps) { this.draw(); return; }
    var sc = document.createElement('canvas'); sc.width = sc.height = 1024;
    var sx = sc.getContext('2d'), i = 0;
    (function next() {
      if (self.__tiles !== key) return;
      if (i >= 64) { self.small = sc; self.draw(); return; }
      var im = new Image(), n = i++;
      im.onload = function () { sx.drawImage(im, (n % 8) * 128, Math.floor(n / 8) * 128, 128, 128); im.src = ''; next(); };
      im.onerror = next;
      im.src = maps[n];
    })();
    this.draw();
  };
  WorldView.prototype.tile = function (n) {
    var t = this.full[n], self = this, maps = this.maps();
    if (t) { t.at = Date.now(); return t.ok ? t.im : null; }
    if (!maps) return null;
    t = this.full[n] = { im: new Image(), ok: false, at: Date.now() };
    t.im.onload = function () { t.ok = true; self.draw(); };
    t.im.src = maps[n];
    // keep a few screens only
    var keys = Object.keys(this.full);
    if (keys.length > 24) {
      keys.sort(function (a, b) { return self.full[a].at - self.full[b].at; }).slice(0, keys.length - 24).forEach(function (k) {
        self.full[k].im.onload = null; self.full[k].im.src = ''; delete self.full[k];
      });
    }
    return null;
  };
  WorldView.prototype.draw = function () {
    var self = this;
    if (this.raf) return;
    this.raf = requestAnimationFrame(function () { self.raf = 0; self.drawNow(); });
  };
  WorldView.prototype.drawNow = function () {
    var W = this.box.clientWidth, H = this.box.clientHeight;
    if (!W || !H) return;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    if (this.cv.width !== Math.round(W * dpr) || this.cv.height !== Math.round(H * dpr)) { this.cv.width = Math.round(W * dpr); this.cv.height = Math.round(H * dpr); }
    var cx = this.cx, z = this.zoom, px = this.pan[0], py = this.pan[1];
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx.fillStyle = '#050607'; cx.fillRect(0, 0, W, H);
    cx.imageSmoothingEnabled = z * dpr < 1;
    var maps = this.maps();
    if (!maps) { cx.fillStyle = '#1a2a1a'; cx.fillRect(px, py, 4096 * z, 4096 * z); }
    else {
      var useFull = z * dpr > 0.3;
      if (this.small) cx.drawImage(this.small, px, py, 4096 * z, 4096 * z);
      if (useFull) {
        var x0 = Math.max(0, Math.floor(-px / z / 512)), x1 = Math.min(7, Math.floor((W - px) / z / 512));
        var y0 = Math.max(0, Math.floor(-py / z / 512)), y1 = Math.min(7, Math.floor((H - py) / z / 512));
        for (var ty = y0; ty <= y1; ty++) for (var tx = x0; tx <= x1; tx++) {
          var im = this.tile(ty * 8 + tx);
          if (im) cx.drawImage(im, px + tx * 512 * z, py + ty * 512 * z, 512 * z + 0.5, 512 * z + 0.5);
        }
      }
    }
    if (!document.body.classList.contains('no-grid')) {
      cx.strokeStyle = 'rgba(255,255,255,.14)'; cx.lineWidth = 1; cx.beginPath();
      for (var i = 1; i < 8; i++) {
        var gx = Math.round(px + i * 512 * z) + 0.5, gy = Math.round(py + i * 512 * z) + 0.5;
        cx.moveTo(gx, py); cx.lineTo(gx, py + 4096 * z); cx.moveTo(px, gy); cx.lineTo(px + 4096 * z, gy);
      }
      cx.stroke();
    }
  };
  WorldView.prototype.fit = function () {
    var W = this.box.clientWidth, H = this.box.clientHeight;
    if (!W || !H) return;
    this.userMoved = false;
    this.zoom = this.fitZ = Math.min(W, H) / 4096;
    this.pan = [(W - 4096 * this.zoom) / 2, (H - 4096 * this.zoom) / 2];
    this.apply();
  };
  WorldView.prototype.apply = function () {
    var W = this.box.clientWidth, H = this.box.clientHeight;
    // a broken zoom (or none yet): back to the whole world
    if (!isFinite(this.zoom) || this.zoom <= 0 || !isFinite(this.pan[0]) || !isFinite(this.pan[1])) { if (W && H) { this.fit(); return; } }
    // keep part of the world on screen: it can't be dragged away and lost
    if (W && H) {
      var m = Math.min(80, W / 3, H / 3), size = 4096 * this.zoom;
      this.pan[0] = Math.max(m - size, Math.min(W - m, this.pan[0]));
      this.pan[1] = Math.max(m - size, Math.min(H - m, this.pan[1]));
    }
    var z = this.zoom, px = this.pan[0], py = this.pan[1], self = this;
    // pins keep their size on screen, a little bigger when zoomed in
    var ps = (this.box.clientWidth < 500 ? 0.85 : 1) * Math.min(1.8, Math.max(1, Math.sqrt(z / (this.fitZ || z))));
    this.pins.style.setProperty('--pz', ps);
    // small screens: entrance tags only once zoomed in a little (they'd cover the map)
    this.pins.classList.toggle('notag', this.box.clientWidth < 500 && z < (this.fitZ || z) * 1.5);
    Object.keys(this.pinEls).forEach(function (id) {
      var p = self.pinEls[id];
      p.style.left = (px + p.__x * z) + 'px'; p.style.top = (py + p.__y * z) + 'px';
    });
    this.draw();
  };
  WorldView.prototype.zoomAt = function (cx, cy, f) { this.setZoomAt(cx, cy, this.clampZ(this.zoom * f)); };
  WorldView.prototype.setZoomAt = function (cx, cy, z) {
    var r = this.box.getBoundingClientRect(), x = cx - r.left, y = cy - r.top;
    this.pan = [x - (x - this.pan[0]) * z / this.zoom, y - (y - this.pan[1]) * z / this.zoom];
    this.zoom = z; this.userMoved = true; this.apply();
  };
  WorldView.prototype.place = function (p, at) {
    p.__x = at.x; p.__y = at.y;
    p.style.left = (this.pan[0] + at.x * this.zoom) + 'px'; p.style.top = (this.pan[1] + at.y * this.zoom) + 'px';
  };
  WorldView.prototype.paintPins = function () {
    var self = this, seen = {};
    M.checks.forEach(function (c) {
      if (c.world !== self.world) return;
      var id = 'c' + c.id; seen[id] = 1;
      var p = self.pinEls[id];
      if (!p) {
        p = self.pinEls[id] = el('div', 'pin');
        self.place(p, M.checkAt(c));
        hookPin(p, function () { return { kind: 'check', c: c }; });
        self.pins.appendChild(p);
      }
      var col = M.colors[c.id];
      var cls = 'pin ' + (col === null || c.hidden ? 'gone' : M.cleared[c.id] ? 'done' : (col || 'red'));
      if (p.className !== cls) p.className = cls;
      var mk = M.marks[c.id];
      var cur = p.querySelector('img');
      if (mk && M.icons[mk]) { if (!cur) { cur = el('img'); cur.alt = ''; p.appendChild(cur); } if (cur.getAttribute('src') !== M.icons[mk]) cur.src = M.icons[mk]; }
      else if (cur) cur.remove();
    });
    // a second spot for some checks (same state as the check itself)
    (M.ALSO || []).forEach(function (a) {
      if (a.world !== self.world) return;
      var c = M.checks.filter(function (x) { return x.id === a.id; })[0]; if (!c) return;
      var id = 'a' + a.id + a.world; seen[id] = 1;
      var p = self.pinEls[id];
      if (!p) {
        p = self.pinEls[id] = el('div', 'pin');
        self.place(p, { x: a.at[0], y: a.at[1] });
        hookPin(p, function () { return { kind: 'check', c: c, label: a.name }; });
        self.pins.appendChild(p);
      }
      var col = M.colors[c.id];
      var cls = 'pin ' + (col === null ? 'gone' : M.cleared[c.id] ? 'done' : (col || 'red'));
      if (p.className !== cls) p.className = cls;
    });
    Object.keys(M.dungeons).forEach(function (k) {
      var d = M.dungeons[k]; if (!d || d.world !== self.world || (M.dhidden && M.dhidden[k])) return;
      var at = M.dungeonAt(k); if (!at) return;
      var id = 'd' + k; seen[id] = 1;
      var p = self.pinEls[id];
      if (!p) {
        p = self.pinEls[id] = el('div', 'pin dgn');
        self.place(p, at);
        hookPin(p, function () { return { kind: 'dungeon', k: k }; });
        self.pins.appendChild(p);
      }
      var cls = 'pin dgn ' + (M.dcleared[k] ? 'done' : (M.dcolors[k] || 'red'));
      if (p.className !== cls) p.className = cls;
    });
    // entrances (entrance shuffle): every door and hole, where it leads
    var pend = M.entPending ? M.entPending() : null;
    (M.entrances || []).forEach(function (e) {
      if (e.world !== self.world) return;
      var id = 'e' + e.id; seen[id] = 1;
      var p = self.pinEls[id];
      if (!p) {
        p = self.pinEls[id] = el('div', 'pin ent');
        p.appendChild(el('i'));
        hookEnt(p, e.id);
        self.pins.appendChild(p);
      }
      if (p.__x !== e.at.x || p.__y !== e.at.y) self.place(p, e.at);
      var cls = 'pin ent ' + (e.shape || 'round') + (e.done ? ' done' : '') + (e.color ? '' : ' ' + (e.cls || 'red')) + (pend === e.id ? ' pend' : '');
      if (p.className !== cls) p.className = cls;
      var bg = e.done ? '' : (e.color || '');
      if (p.firstChild.style.background !== bg) p.firstChild.style.background = bg;
      var tag = p.querySelector('.tag');
      if (e.label) {
        if (!tag) { tag = el('span', 'tag'); p.appendChild(tag); }
        if (tag.textContent !== e.label) tag.textContent = e.label;
        tag.style.borderColor = e.labelColor || '#888';
      } else if (tag) tag.remove();
      p.title = e.name + (e.to ? ' → ' + e.to : '');
    });
    Object.keys(this.pinEls).forEach(function (id) { if (!seen[id]) { self.pinEls[id].remove(); delete self.pinEls[id]; } });
  };

  function layoutWorlds() {
    var w = $('worlds'), W = w.clientWidth, H = w.clientHeight;
    var stack = W && H && (H / 2 > W / 2 ? Math.min(W, H / 2) > Math.min(W / 2, H) : false);
    w.classList.toggle('stack', !!stack);
    views.forEach(function (v) { v.box.style.display = phoneTab === 'lw' || phoneTab === 'dw' ? (phoneTab === v.world ? '' : 'none') : ''; });
    requestAnimationFrame(function () { views.forEach(function (v) { if (!v.userMoved || !v.fitZ) v.fit(); else v.apply(); }); });
  }

  // ── the card: what's at a check, and what to do about it ──────────────────
  var card = $('card'), cardFor = null, cardSticky = false, cardTimer = null;
  // A check: click (tap) marks it done, or open again; right click (hold) opens
  // its card, to mark which item is there (and, with several places in one
  // square, tick them off one by one). A dungeon: click opens its card.
  function hookPin(p, what) {
    p.addEventListener('click', function (e) {
      e.stopPropagation();
      var w = what();
      if (w.kind === 'check') { hideCard(); M.toggleCheck(w.c.id, !M.cleared[w.c.id]); }
      else showCard(w, p, true);
    });
    p.addEventListener('contextmenu', function (e) { e.preventDefault(); e.stopPropagation(); var w = what(); showCard(w, p, true, w.kind === 'check'); });
    longPress(p, function () { var w = what(); showCard(w, p, true, w.kind === 'check'); });
  }
  // An entrance: click marks it done (or, while joining a connector, picks
  // its other end); right click (hold) opens its menu.
  function hookEnt(p, id) {
    p.addEventListener('click', function (e) {
      e.stopPropagation();
      if (M.entPending && M.entPending() && M.entPending() !== id) { M.entConnectTo(id); return; }
      hideCard(); M.entClick(id);
    });
    function menu() { if (M.entMenu && M.entMenu(id, p)) return; showCard({ kind: 'ent', id: id }, p, true); }
    p.addEventListener('contextmenu', function (e) { e.preventDefault(); e.stopPropagation(); menu(); });
    longPress(p, menu);
  }
  function entById(id) { return (M.entrances || []).filter(function (x) { return x.id === id; })[0]; }
  card.addEventListener('mouseenter', function () { clearTimeout(cardTimer); });
  card.addEventListener('mouseleave', function () { if (!cardSticky) cardTimer = setTimeout(hideCard, 250); });
  document.addEventListener('pointerdown', function (e) { if (card.classList.contains('show') && !card.contains(e.target) && !e.target.closest('.pin')) hideCard(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { hideCard(); if (M.entPending && M.entPending()) M.entCancel(); } });
  function hideCard() { card.classList.remove('show'); cardFor = null; cardSticky = false; document.querySelectorAll('.pin.hl').forEach(function (p) { p.classList.remove('hl'); }); }
  function showCard(w, pin, sticky, picking) {
    clearTimeout(cardTimer);
    cardFor = { w: w, pin: pin }; cardSticky = sticky;
    document.querySelectorAll('.pin.hl').forEach(function (p) { p.classList.remove('hl'); });
    pin.classList.add('hl');
    fillCard(picking);
    card.classList.add('show');
    var r = pin.getBoundingClientRect(), cw = card.offsetWidth, ch = card.offsetHeight;
    var x = r.right + 8, y = r.top - 8;
    if (x + cw > innerWidth - 6) x = r.left - cw - 8;
    if (x < 6) x = Math.max(6, Math.min(innerWidth - cw - 6, r.left - cw / 2));
    if (y + ch > innerHeight - 6) y = innerHeight - ch - 6;
    card.style.left = Math.max(6, x) + 'px'; card.style.top = Math.max(6, y) + 'px';
  }
  function fillCard(picking) {
    if (!cardFor) return;
    var w = cardFor.w; card.textContent = '';
    var x = el('button', 'x', '✕'); x.type = 'button'; x.title = 'Close (Esc)'; x.addEventListener('click', hideCard); card.appendChild(x);
    var btns = el('div', 'btns');
    function btn(label, fn, title) { var b = el('button', null, label); b.type = 'button'; if (title) b.title = title; b.addEventListener('click', function (e) { e.stopPropagation(); fn(); }); btns.appendChild(b); }
    if (w.kind === 'ent') {
      var en = entById(w.id); if (!en) { hideCard(); return; }
      card.appendChild(el('h4', null, en.name));
      var es = el('div', 'st'); var ei = el('i'); ei.style.background = en.done ? CSS.done : (en.color || CSS[en.cls] || '#555'); es.appendChild(ei);
      es.appendChild(document.createTextNode(en.done ? 'Done' : en.to ? 'Leads to ' + en.to : en.label ? 'Marked ' + en.label : 'Not found yet'));
      card.appendChild(es);
      if (en.links && en.links.length) card.appendChild(el('div', 'st', 'Connector to: ' + en.links.join(', ')));
      btn(en.done ? '↺ Not done' : '✓ Done', function () { M.entClick(en.id); hideCard(); });
      if (M.entConnectStart) btn(M.entPending && M.entPending() === en.id ? 'Cancel' : (M.entConnectLabel || 'Connector…'), function () {
        if (M.entPending() === en.id) M.entCancel(); else { M.entConnectStart(en.id); M.toast(M.entConnectHint || 'Now click the other end of the connector (Esc to cancel).'); }
        hideCard();
      }, M.entConnectTitle || 'Join this door to the other door of the same cave');
      if (M.entMore) btn(M.entMoreLabel || 'More…', function () { hideCard(); M.entMore(en.id); }, M.entMoreTitle || '');
      if (M.entClear && (en.label || en.to || (en.links && en.links.length))) btn('Clear', function () { M.entClear(en.id); hideCard(); }, 'Forget where it leads');
      card.appendChild(btns);
      (en.links || []).forEach(function (o) {
        var r = el('div', 'btns'); var b2 = el('button', null, '✕ ' + o); b2.type = 'button'; b2.title = 'Remove this connector';
        b2.addEventListener('click', function (e) { e.stopPropagation(); M.entUnlink(en.id, o); hideCard(); }); r.appendChild(b2); card.appendChild(r);
      });
      var groups = M.entCodes ? M.entCodes(en.id) : [];
      groups.forEach(function (g) {
        card.appendChild(el('div', 'sub', g.title));
        var gr = el('div', 'codes');
        g.codes.forEach(function (c) {
          var b3 = el('button', 'code' + ((c.on != null ? c.on : en.label === c.text) ? ' on' : ''), c.text); b3.type = 'button';
          if (c.color) b3.style.background = c.color;
          if (c.title) b3.title = c.title;
          if (c.disabled) { b3.disabled = true; b3.style.opacity = '.35'; }
          b3.addEventListener('click', function (e) { e.stopPropagation(); M.entLabel(en.id, c.code); hideCard(); });
          gr.appendChild(b3);
        });
        card.appendChild(gr);
      });
      return;
    }
    if (w.kind === 'check') {
      var c = w.c, done = !!M.cleared[c.id], col = done ? 'done' : (M.colors[c.id] || 'red');
      card.appendChild(el('h4', null, w.label || c.name));
      var st = el('div', 'st'); var i = el('i'); i.style.background = CSS[col] || '#555'; st.appendChild(i); st.appendChild(document.createTextNode(COLOR_WORD[col] || col)); card.appendChild(st);
      if (M.marks[c.id]) { var m = el('div', 'st', 'Marked: '); var mi = iconImg(M.marks[c.id]); if (mi) { mi.style.width = mi.style.height = '20px'; mi.style.verticalAlign = 'middle'; mi.style.imageRendering = 'pixelated'; m.appendChild(mi); } card.appendChild(m); }
      btn(done ? '↺ Not done' : (M.locsOf && M.locsOf(c.id).length > 1 ? '✓ All done' : '✓ Done'), function () { M.toggleCheck(c.id, !done); hideCard(); }, done ? 'Open it again' : 'Mark it collected');
      btn('Mark an item…', function () { fillCard(true); }, 'Note which item is there (shows on the map)');
      card.appendChild(btns);
      // a square with several places in it: each one, to tick off on its own
      var locs = M.locsOf ? M.locsOf(c.id) : [];
      if (locs.length > 1) {
        var ul = el('div', 'locs');
        locs.forEach(function (L) {
          var row = el('button', 'loc' + (L.done ? ' done' : '')); row.type = 'button';
          var d = el('i'); d.style.background = CSS[L.done ? 'done' : L.color] || '#555'; row.appendChild(d);
          row.appendChild(document.createTextNode(L.label));
          row.title = L.done ? 'Done: click to open it again' : (COLOR_WORD[L.color] || '') + ': click to mark it done';
          row.addEventListener('click', function (e) { e.stopPropagation(); M.toggleLoc(L.name, !L.done); setTimeout(function () { fillCard(false); }, 120); });
          ul.appendChild(row);
        });
        card.appendChild(ul);
      }
      if (picking) {
        var pick = el('div', 'pick');
        var keys = ['bow2', 'boomerang1', 'boomerang2', 'hookshot', 'bomb', 'mushroom', 'powder', 'firerod', 'icerod', 'bombos', 'ether', 'quake', 'lamp', 'hammer',
          'shovel', 'flute', 'net', 'book', 'bottle1', 'somaria', 'byrna', 'cape', 'mirror', 'boots', 'gloves1', 'gloves2', 'flippers', 'moonpearl',
          'sword1', 'shield1', 'tunic1', 'bow3', 'bigkey', 'map', 'compass', 'crystal', 'pendant_green'];
        keys.forEach(function (k) {
          if (!M.icons[k]) return;
          var b = el('button'); b.type = 'button'; b.title = k; var im = iconImg(k); b.appendChild(im);
          b.addEventListener('click', function (e) { e.stopPropagation(); M.mark(c.id, k); fillCard(false); });
          pick.appendChild(b);
        });
        if (M.marks[c.id]) { var cl = el('button', null, '✕'); cl.type = 'button'; cl.title = 'Clear the mark'; cl.addEventListener('click', function (e) { e.stopPropagation(); M.mark(c.id, null); fillCard(false); }); pick.appendChild(cl); }
        if (!pick.children.length) pick.appendChild(el('span', null, 'Item pictures are still being drawn from the game…'));
        card.appendChild(pick);
      }
    } else {
      var k = w.k, nm = (DGS.filter(function (d) { return d[0] === k; })[0] || [k, k, k])[2], it = M.items || {};
      card.appendChild(el('h4', null, nm));
      var dc = M.dcleared[k] ? 'done' : (M.dcolors[k] || 'red');
      var s2 = el('div', 'st'); var i2 = el('i'); i2.style.background = CSS[dc] || '#555'; s2.appendChild(i2); s2.appendChild(document.createTextNode(COLOR_WORD[dc] || dc)); card.appendChild(s2);
      var max = it[k + 'MaxChests'];
      if (max != null) card.appendChild(el('div', 'st', 'Chests: ' + (it[k + 'Chests'] || 0) + ' of ' + max + (it[k + 'BigKey'] ? ' · big key ✓' : '')));
      var short = (DGS.filter(function (d) { return d[0] === k; })[0] || [])[1];
      btn('Open its map', function () { var i = dgIndex(short); hideCard(); if (i >= 0) selectDg(i); });
      card.appendChild(btns);
    }
  }

  // ── World / dungeon buttons, and the dungeon map ──────────────────────────
  var dgSel = -1, dgView = null, dgBtns = [];
  function buildDgBar() {
    var bar = $('dgbar'); bar.textContent = '';
    function mk(i, label, title) {
      var b = el('button', 'dg-btn', label); b.type = 'button'; b.title = title;
      b.addEventListener('click', function () { selectDg(i); });
      bar.appendChild(b); dgBtns.push(b);
    }
    mk(-1, 'World', 'The Light and Dark World');
    if (D) {
      D.list.forEach(function (d, i) { mk(i, d[1], d[2]); });
      dgView = new D.View($('dgview'));
      D.onEnter = function (dg) { selectDg(dg); };
    }
  }
  function selectDg(i) { dgSel = i; paintDg(); }
  function paintDg() {
    var here = D ? D.where().dg : -1;
    $('worlds').style.display = dgSel < 0 ? '' : 'none';
    $('dgview').style.display = dgSel < 0 ? 'none' : '';
    dgBtns.forEach(function (b, k) {
      var i = k - 1;
      b.classList.toggle('on', i === dgSel);
      b.classList.toggle('here', i >= 0 && i === here);
      b.classList.toggle('seen', i >= 0 && D && D.explored(i));
    });
    if (dgSel >= 0 && dgView && dgView.dg !== dgSel) dgView.show(dgSel);
    if (dgSel < 0) layoutWorlds();
  }
  setInterval(paintDg, 1000);

  // ── footer: counters from the game ────────────────────────────────────────
  function paintStats() {
    var it = M.items || {}, g = it.gtBk || null, s = $('stats');
    var parts = M.stats ? M.stats() : [['Checks', it.checks || 0], ['Deaths', it.deaths || 0], ['Bonks', it.bonks || 0]];
    var html = parts.map(function (p) { return '<span>' + p[0] + ' <b>' + p[1] + '</b></span>'; }).join('');
    if (g && g.enabled !== false) html += '<span title="Ganon’s Tower: chests opened, and which chest had the big key">GT chests <b>' + (g.chests || 0) + '</b>/26' + (g.found ? ' · big key at <b>' + (g.at != null ? g.at : '?') + '</b>' : '') + '</span>';
    s.innerHTML = html;
  }

  // ── link status ───────────────────────────────────────────────────────────
  function paintLink() {
    var l = $('link'), t = $('link-t');
    var on = M.linked && !!M.items;
    l.classList.toggle('on', on);
    t.textContent = M.linkText ? M.linkText() : !M.linked ? 'Waiting for Hutch’s logic…' : !M.items ? 'Waiting for the item tracker…' : M.iconState === 'drawing' ? 'Drawing items from the game…' : 'Live';
  }

  // ── options ───────────────────────────────────────────────────────────────
  var SIZE_KEY = 'rhb-mudora-isize', isize = 'auto';
  try { isize = localStorage.getItem(SIZE_KEY) || 'auto'; } catch (e) {}
  function applySize() {
    var side = $('side'), px;
    if (isize === 'auto') {
      var W = phoneTab === 'items' ? innerWidth - 24 : Math.min(innerWidth * 0.32, 340);
      px = Math.max(26, Math.min(phoneTab ? 48 : 64, Math.floor((W - 30 - 5 * 4) / 6)));
    } else px = +isize;
    document.documentElement.style.setProperty('--isz', px + 'px');
  }
  $('isize').value = isize;
  $('isize').addEventListener('change', function () { isize = this.value; try { localStorage.setItem(SIZE_KEY, isize); } catch (e) {} applySize(); layoutWorlds(); });
  var gridOn = true;
  try { gridOn = localStorage.getItem('rhb-mudora-grid') !== '0'; } catch (e) {}
  $('o-grid').checked = gridOn; document.body.classList.toggle('no-grid', !gridOn);
  $('o-grid').addEventListener('change', function () { document.body.classList.toggle('no-grid', !this.checked); views.forEach(function (v) { v.draw(); }); try { localStorage.setItem('rhb-mudora-grid', this.checked ? '1' : '0'); } catch (e) {} });
  function dgModes() {
    var sel = $('dgmode');
    if (!D) { sel.parentNode.style.display = 'none'; return; }
    var opts = [['explore', 'Explore (fog of war)'], ['map', 'Map (like the game)']];
    if (!document.body.classList.contains('phone')) opts.push(['full', 'Full (every room)']);
    var sig = opts.map(function (o) { return o[0]; }).join();
    if (sel.__sig !== sig) { sel.__sig = sig; sel.textContent = ''; opts.forEach(function (o) { var e = el('option', null, o[1]); e.value = o[0]; sel.appendChild(e); }); }
    sel.value = D.mode();
  }
  $('dgmode').addEventListener('change', function () {
    var m = this.value;
    if (m === 'full' && D.pref() !== 'full' && !confirm('Full dungeon maps show every room of every dungeon right away, before you’ve been there.\n\n' +
        'That’s meant for players new to rando: seeing the whole dungeon helps find the way to each check (and the pots in pot shuffle). ' +
        'It gives away the layout, so if you like finding your own way, keep Explore.\n\nUse full maps?')) { this.value = D.mode(); return; }
    D.setMode(m);
  });
  // put every map back as it started (both worlds, and the dungeon map)
  function resetMaps() {
    hideCard();
    layoutWorlds();
    views.forEach(function (v) { v.userMoved = false; v.fit(); });
    if (dgView && dgView.fit) { try { dgView.fit(); } catch (e) {} }
  }
  window.MudoraResetMaps = resetMaps;
  $('b-reset').addEventListener('click', resetMaps);
  $('gear').addEventListener('click', function (e) { e.stopPropagation(); document.body.classList.toggle('bar-open'); });
  // phone: tapping anywhere else closes the options
  document.addEventListener('pointerdown', function (e) {
    if (!document.body.classList.contains('bar-open') || !document.body.classList.contains('phone')) return;
    if (e.target.closest('#bar') || e.target.closest('#gear') || e.target.closest('#set') || e.target.closest('#card')) return;
    document.body.classList.remove('bar-open');
  });
  // on a phone the colour key lives with the options, not under the map
  function placeLegend() {
    var lg = $('legend'), want = document.body.classList.contains('phone') ? $('bar') : $('foot');
    if (lg && lg.parentNode !== want) want.appendChild(lg);
  }
  $('b-help').addEventListener('click', function () {
    if (M.helpText) { alert(M.helpText); return; }
    alert('Mudora — Rando Hub’s own tracker.\n\n' +
      'Logic: Hutch’s tracker, unchanged (it runs out of sight and Mudora shows its answers). Pictures, maps and where each check sits come from your game itself.\n\n' +
      'Items: click to go up, right click (hold on a phone) to go back. Right click Bombos, Ether or Quake to mark which of Misery Mire / Turtle Rock it opens.\n' +
      'Map: click (tap) a square to mark it done; click again to open it again. Right click (hold) a square to mark which item is there. ⟲ on a map, or Reset maps at the top, puts the maps back as they started.\n' +
      'Dungeons: click a dungeon to open its map (entering one in the game shows it too). Chests, small keys, big key, map and compass: click to count, right click to undo.\n\n' +
      'Zoom with the wheel or a pinch, drag to move, double-click (double-tap) to fit.');
  });

  // ── phone: Rando Hub's tabs (items / Light World / Dark World) ────────────
  var phoneTab = null;
  window.MudoraPhone = {
    set: function (t) {
      t = t === 'lw' || t === 'dw' || t === 'items' || t === 'keys' ? t : null;
      phoneTab = t;
      document.body.classList.toggle('phone', !!t);
      ['items', 'keys', 'lw', 'dw'].forEach(function (x) { document.body.classList.toggle('ph-' + x, t === x); });
      dgModes(); applySize(); placeLegend(); layoutWorlds();
    },
    zoom: function (dir) {
      var v = views.filter(function (x) { return x.box.offsetParent; })[0];
      if (v) { var r = v.box.getBoundingClientRect(); v.zoomAt(r.left + r.width / 2, r.top + r.height / 2, dir > 0 ? 1.4 : 1 / 1.4); }
    },
  };
  var qs = new URLSearchParams(location.search);
  if (qs.get('phone')) window.MudoraPhone.set(qs.get('phone'));

  // ── start ─────────────────────────────────────────────────────────────────
  function onResize() { applySize(); layoutWorlds(); }
  var rt = null;
  window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(onResize, 80); });
  buildItems(); buildDungeons(); buildDgBar();
  ['lw', 'dw'].forEach(function (w) { $('worlds').appendChild(new WorldView(w).box); });
  applySize(); dgModes(); paintDg(); paintStats(); paintLink();
  M.on(function (what) {
    if (what === 'items') { paintItems(); paintDungeons(); paintStats(); paintLink(); }
    else if (what === 'checks') { views.forEach(function (v) { v.paintPins(); }); paintDungeons(); if (cardFor && !cardSticky) fillCard(false); }
    else if (what === 'dungeons') paintDungeons();
    else if (what === 'maps') views.forEach(function (v) { v.paintTiles(); });
    else if (what === 'icons') { paintItems(); paintDungeons(); views.forEach(function (v) { v.paintPins(); }); var bi = $('brand-ic'); if (M.icons.book) bi.src = M.icons.book; paintLink(); }
    else if (what === 'link') paintLink();
  });
  setTimeout(onResize, 50);
})();
