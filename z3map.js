/*
 * z3map.js — a world map for Zelda 3 ROM hacks (Patched games): the hack's own
 * overworld map, drawn from the ROM that's running, with Link on it and pins
 * you drop yourself. Nothing is known about the hack in advance: whatever map
 * its author put in the ROM is what's shown (Allhallows Eve, Parallel Worlds,
 * any hack made with ZScream).
 *
 *   Z3Map.attach({ player, host, gameId, hackOnly, onShow })
 *       watches the player; shows the map once a Zelda 3 ROM is running
 *       (hackOnly: only when its map isn't the vanilla one, for the hub, where
 *       vanilla and randomizer ROMs have Mudora's map already)
 *   Z3Map.isHack(rom)   true for a Zelda 3 ROM whose world map isn't vanilla's
 *
 * The picture is the game's own pause-screen map (press X): a Mode 7 picture of
 * 8x8 tiles, one byte a pixel, 256 tiles at ROM $18:C000 (PC 0x0C4000, 16 KB);
 * the Light World tilemap is 64x64 tiles at $0A:C727 (PC 0x54727) in four 32x32
 * quarters, the Dark World 32x32 at $0A:D727 (PC 0x55727), half the scale; the
 * colours at $0A:DB27 (PC 0x55B27), 128 a world. Offsets of the US ROM, which
 * ZScream hacks are built on. A hack can move the pictures: when the game's
 * loaders are hooked (a JSL at $00:E399 for the tiles, $00:8E54 for the
 * tilemap; Allhallows Eve does this), the hook's code says where each world's
 * tiles ("LDA #bank / STA $02 ... LDY #addr / STY $00") and tilemap ("LDA #bank
 * / STA $4304", from $8000, 64x64 in four quarters) are, and those are used. Link: $7E:008A the overworld area (bit 6 = Dark
 * World), $7E:0022 / $7E:0020 his x / y in the world (4096 px across, so an
 * eighth of that on the 512 px map), $7E:001B indoors.
 *
 * Dungeons: the game's dungeon map screen, from where ZScream keeps it (US ROM
 * offsets, as ZScream reads them): per dungeon (14) the floors at PC 0x575D9
 * (a word: low nibble the basements, next nibble the floors above), a pointer
 * at 0x57605 to its floors, 25 bytes a floor (a 5x5 grid of room numbers, 0x0F
 * none), a pointer at 0x57BE4 to one shape byte for each room in that grid, and
 * the shapes (4 tile words a room, its four quarters; tile 0x300 is blank) at
 * 0x109010 when ZScream has moved them there, else 0x57009; the boss room at
 * 0x56807. In the game: $7E:040C the dungeon x2 ($FF none), $7E:00A4 the floor
 * (signed, 0 = 1F), $7E:00A0 the room, $7E:F000 + room x2 the quarters seen
 * (8 top left, 4 top right, 2 bottom left, 1 bottom right), $7E:F368 the maps
 * and $7E:F364 the compasses held (bit 15 - dungeon). Shown as the game shows
 * it (rooms seen, or all of them with the map, the boss with the compass), or
 * every room with "All rooms".
 */
(function () {
  'use strict';
  var GFX = 0x0C4000, LW = 0x54727, DW = 0x55727, PAL = 0x55B27, W = 512;
  var WORLDS = ['Light World', 'Dark World', 'Dungeons'];
  var C = 32;                                 // a dungeon room on the map, in map units
  var dung = -1, dfloor = 0, showAll = false, dcache = { rom: null, list: null }, dsub = null;
  var host, stage, cv, ctx, tabs, label, followBtn, pinBtn, atBtn;
  var player = null, gameId = '', rom = null, pics = {};
  var world = 0, follow = true, zoom = 1, tx = 0, ty = 0, moved = false, dirty = false, placing = false;
  var dtick = 0, onWorld = null, z3root = null;
  var link = null, lastOut = null, pins = [], sel = -1, shown = false, hackOnly = false, onShow = null;

  function isZ3(r) {
    if (!r || r.length < 0x100000) return false;
    var t = ''; for (var i = 0x7FC0; i < 0x7FD5; i++) t += String.fromCharCode(r[i]);
    if (!/^THE LEGEND OF ZELDA|^ZELDANODENSETSU/.test(t)) return false;
    for (var j = 0; j < 256; j++) if ((r[PAL + j * 2] | r[PAL + j * 2 + 1] << 8) > 0x7FFF) return false;   // not the US layout
    return true;
  }
  // the vanilla map data (FNV-1a of PC 0x54727-0x55B27: both tilemaps), as the
  // Japanese 1.0 ROM has it; randomizer seeds keep it
  var VANILLA = ['ebec8708'];
  function mapHash(r) { var h = 0x811c9dc5; for (var i = 0x54727; i < 0x55B27; i++) { h ^= r[i]; h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(16).padStart(8, '0'); }
  function hooked(r) { return r[0x6399] === 0x22 || r[0x0E54] === 0x22; }   // a hack that moved its map
  function isHack(r) { return isZ3(r) && (VANILLA.indexOf(mapHash(r)) < 0 || hooked(r)); }
  function lorom(bank, addr) { return (bank & 0x7F) * 0x8000 + (addr & 0x7FFF); }
  function jslAt(pc) { return rom[pc] === 0x22 ? lorom(rom[pc + 3], rom[pc + 1] | rom[pc + 2] << 8) : -1; }
  // where each world's map comes from: { gfx, tm, quarters } (PC offsets)
  function sources() {
    var out = [{ gfx: GFX, tm: LW, quarters: true }, { gfx: GFX, tm: DW, quarters: false }];
    try {
      var g = jslAt(0x6399), t = jslAt(0x0E54), i, k, found;
      if (g > 0 && g + 0x100 < rom.length) {
        found = [];
        for (i = g; i < g + 0x100 && found.length < 2; i++) {
          if (rom[i] === 0xA9 && rom[i + 2] === 0x85 && rom[i + 3] === 0x02) {
            for (k = i + 4; k < i + 40; k++) if (rom[k] === 0xA0 && rom[k + 3] === 0x84 && rom[k + 4] === 0x00) { found.push(lorom(rom[i + 1], rom[k + 1] | rom[k + 2] << 8)); break; }
          }
        }
        if (found[0] != null) out[0].gfx = found[0];
        if (found[1] != null) out[1].gfx = found[1];
      }
      if (t > 0 && t + 0x100 < rom.length) {
        found = [];
        for (i = t; i < t + 0x100 && found.length < 2; i++) if (rom[i] === 0xA9 && rom[i + 2] === 0x8D && rom[i + 3] === 0x04 && rom[i + 4] === 0x43) found.push(lorom(rom[i + 1], 0x8000));
        if (found[0] != null) out[0] = { gfx: out[0].gfx, tm: found[0], quarters: true };
        if (found[1] != null) out[1] = { gfx: out[1].gfx, tm: found[1], quarters: true };
      }
      out.forEach(function (o) { if (o.gfx + 0x4000 > rom.length || o.tm + 0x1000 > rom.length) throw 0; });
    } catch (e) { out = [{ gfx: GFX, tm: LW, quarters: true }, { gfx: GFX, tm: DW, quarters: false }]; }
    return out;
  }
  function picture(w) {
    if (pics[w]) return pics[w];
    var src = sources()[w], size = src.quarters ? 512 : 256, c = document.createElement('canvas'); c.width = c.height = size;
    var g = c.getContext('2d'), id = g.createImageData(size, size), px = id.data, pb = w ? 128 : 0, x0 = size, y0 = size, x1 = 0, y1 = 0;
    var cols = [];
    for (var i = 0; i < 128; i++) { var v = rom[PAL + (pb + i) * 2] | rom[PAL + (pb + i) * 2 + 1] << 8; cols.push([(v & 31) << 3, ((v >> 5) & 31) << 3, ((v >> 10) & 31) << 3]); }
    function tile(t, tx0, ty0) {
      var o = src.gfx + t * 64, any = false;
      for (var y = 0; y < 8; y++) for (var x = 0; x < 8; x++) {
        var v = rom[o + y * 8 + x], col = cols[v & 127], p = ((ty0 + y) * size + tx0 + x) * 4;
        px[p] = col[0]; px[p + 1] = col[1]; px[p + 2] = col[2]; px[p + 3] = 255;
        if (v) any = true;
      }
      if (any) { x0 = Math.min(x0, tx0); y0 = Math.min(y0, ty0); x1 = Math.max(x1, tx0 + 8); y1 = Math.max(y1, ty0 + 8); }
    }
    var p = src.tm;
    if (src.quarters) [[0, 0], [32, 0], [0, 32], [32, 32]].forEach(function (q) { for (var r = 0; r < 32; r++) for (var cc = 0; cc < 32; cc++) tile(rom[p++], (q[0] + cc) * 8, (q[1] + r) * 8); });
    else for (var r2 = 0; r2 < 32; r2++) for (var c2 = 0; c2 < 32; c2++) tile(rom[p++], c2 * 8, r2 * 8);
    g.putImageData(id, 0, 0);
    // the drawn part (a hack's map can sit on black inside the 512 x 512), in map units
    var k = W / size;
    c.box = x1 > x0 ? [x0 * k, y0 * k, x1 * k, y1 * k] : [0, 0, W, W];
    return (pics[w] = c);
  }

  // ── dungeons ─────────────────────────────────────────────────────────────
  function word(o) { return rom[o] | rom[o + 1] << 8; }
  function dungeons() {
    if (dcache.rom === rom) return dcache.list;
    var list = [];
    try {
      var cands = [0x109010, 0x57009].filter(function (t) { return t + 0x800 <= rom.length; }), T = -1;
      var raw = [];
      for (var d = 0; d < 14; d++) {
        var f = word(0x575D9 + d * 2), below = f & 15, n = below + ((f >> 4) & 15);
        if (!n || n > 9) { raw.push(null); continue; }
        var base = 0x50000 + (word(0x57605 + d * 2) & 0x7FFF), gb = 0x50000 + (word(0x57BE4 + d * 2) & 0x7FFF);
        var lay = Array.prototype.slice.call(rom, base, base + 25 * n), cnt = lay.filter(function (v) { return v !== 0x0F; }).length;
        if (!cnt) { raw.push(null); continue; }
        raw.push({ d: d, below: below, n: n, lay: lay, shapes: Array.prototype.slice.call(rom, gb, gb + cnt), boss: word(0x56807 + d * 2) });
      }
      // the shape table: the first place where every shape these dungeons use is made of map tiles
      cands.some(function (t) {
        var ok = raw.every(function (x) { return !x || x.shapes.every(function (y) { for (var k = 0; k < 4; k++) { var w = word(t + y * 8 + k * 2) & 0x3FF; if (w < 0x300) return false; } return true; }); });
        if (ok) T = t; return ok;
      });
      if (T >= 0) raw.forEach(function (x) {
        if (!x) return;
        var k = 0, rooms = x.lay.map(function (v) { if (v === 0x0F) return null; var y = x.shapes[k++], q = []; for (var j = 0; j < 4; j++) q.push((word(T + y * 8 + j * 2) & 0x3FF) !== 0x300); return { room: v, q: q }; });
        var c0 = 5, r0 = 5, c1 = 0, r1 = 0;
        rooms.forEach(function (m, i) { if (!m) return; var c = i % 5, r = ((i / 5) | 0) % 5; c0 = Math.min(c0, c); r0 = Math.min(r0, r); c1 = Math.max(c1, c + 1); r1 = Math.max(r1, r + 1); });
        x.rooms = rooms; x.box = [c0 * C, r0 * C, c1 * C, r1 * C];
        list.push(x);
      });
    } catch (e) { list = []; }
    dcache = { rom: rom, list: list };
    return list;
  }
  function dget(d) { var l = dungeons(); for (var i = 0; i < l.length; i++) if (l[i].d === d) return l[i]; return null; }
  function floorName(D, f) { return f < D.below ? 'B' + (D.below - f) : (f - D.below + 1) + 'F'; }
  var REMAP = { 137: 169, 167: 119, 79: 190 };   // rooms the game draws as another (vanilla)
  function cellOf(D, f, room) {
    var row = D.lay.slice(f * 25, f * 25 + 25), i = row.indexOf(room & 0xFF);
    if (i < 0 && REMAP[room] != null) i = row.indexOf(REMAP[room]);
    return i;
  }
  function wram() { var P = typeof player === 'function' ? player() : player; try { return P && P.core && P.core.wram(); } catch (e) { return null; } }
  function drawDungeon(s) {
    var D = dget(dung), wr = wram();
    if (!D) { ctx.fillStyle = '#8b95a3'; ctx.font = '13px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('This hack has no dungeon maps in its ROM.', s[0] / 2, s[1] / 2); return; }
    var bit = 0x8000 >> D.d, hasMap = !!(wr && ((wr[0xF368] | wr[0xF369] << 8) & bit)), hasCompass = !!(wr && ((wr[0xF364] | wr[0xF365] << 8) & bit));
    var all = showAll || hasMap;
    function seen(room) { return wr ? wr[0xF000 + room * 2] & 15 : 0; }
    var here = link && link.w === 2 && link.d === D.d && link.f === dfloor ? link.cell : -1;
    var Q = C / 2, z = zoom, rows = D.rooms.slice(dfloor * 25, dfloor * 25 + 25);
    // which room each visible quarter belongs to (10x10 quarters)
    var grid = [];
    for (var i = 0; i < 25; i++) {
      var m = rows[i]; if (!m) continue;
      var sb = seen(m.room);
      for (var k = 0; k < 4; k++) {
        if (!m.q[k]) continue;
        var vis = sb & (8 >> k);
        if (!vis && !all) continue;
        var qx = (i % 5) * 2 + (k & 1), qy = ((i / 5) | 0) * 2 + (k >> 1);
        grid[qy * 10 + qx] = { room: m.room, vis: !!vis, cell: i };
      }
    }
    if (!grid.some(Boolean)) {
      ctx.font = '13px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#8b95a3';
      ctx.fillText('No rooms seen on this floor yet.', s[0] / 2, s[1] / 2 - 18);
      ctx.fillText('They appear as Link goes (all with the map),', s[0] / 2, s[1] / 2);
      ctx.fillText('or tick All rooms.', s[0] / 2, s[1] / 2 + 18);
    }
    // the floors: rooms, then their walls
    grid.forEach(function (g, j) {
      if (!g) return;
      var x = tx + (j % 10) * Q * z, y = ty + ((j / 10) | 0) * Q * z;
      ctx.fillStyle = g.cell === here ? '#e8d7a0' : g.vis ? '#9db4d6' : '#4a5a78';
      ctx.fillRect(x, y, Q * z + 0.5, Q * z + 0.5);
    });
    ctx.strokeStyle = '#0b0f16'; ctx.lineWidth = Math.max(1.5, z * 1.6); ctx.lineCap = 'square';
    ctx.beginPath();
    grid.forEach(function (g, j) {
      if (!g) return;
      var qx = j % 10, qy = (j / 10) | 0, x = tx + qx * Q * z, y = ty + qy * Q * z, w = Q * z;
      function other(ax, ay) { var n = ax < 0 || ay < 0 || ax > 9 || ay > 9 ? null : grid[ay * 10 + ax]; return !n || n.room !== g.room; }
      if (other(qx, qy - 1)) { ctx.moveTo(x, y); ctx.lineTo(x + w, y); }
      if (other(qx, qy + 1)) { ctx.moveTo(x, y + w); ctx.lineTo(x + w, y + w); }
      if (other(qx - 1, qy)) { ctx.moveTo(x, y); ctx.lineTo(x, y + w); }
      if (other(qx + 1, qy)) { ctx.moveTo(x + w, y); ctx.lineTo(x + w, y + w); }
    });
    ctx.stroke();
    // the boss (with the compass, or All rooms)
    if ((hasCompass || showAll) && D.boss !== 0x0F) {
      var bi = cellOf(D, dfloor, D.boss);
      if (bi >= 0) {
        var bm = rows[bi], qs = [0, 1, 2, 3].filter(function (k) { return bm && bm.q[k]; }); if (!qs.length) qs = [0, 1, 2, 3];
        var bx = tx + ((bi % 5) + qs.reduce(function (a, k) { return a + (k & 1) * 0.5 + 0.25; }, 0) / qs.length) * C * z;
        var by = ty + (((bi / 5) | 0) + qs.reduce(function (a, k) { return a + (k >> 1) * 0.5 + 0.25; }, 0) / qs.length) * C * z;
        ctx.font = Math.round(Math.max(14, C * z * 0.55)) + 'px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ff5a5a'; ctx.fillText('\u2620', bx, by);
      }
    }
    // the floor's name, top left
    ctx.font = '600 13px system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillStyle = '#ffd166';
    ctx.fillText(floorName(D, dfloor) + (hasMap ? ' \u00B7 map' : '') + (hasCompass ? ' \u00B7 compass' : ''), 8, 6);
  }
  function setDungeon(d, f, user) {
    var D = dget(d); if (!D) return;
    var changed = d !== dung;
    dung = d; dfloor = f == null ? (dfloor < D.n ? dfloor : D.below) : Math.max(0, Math.min(D.n - 1, f));
    if (user) { follow = false; followBtn.setAttribute('aria-pressed', 'false'); }
    paintSub();
    if (changed) fit(); else redraw();
  }
  function paintSub() {
    if (!dsub) return;
    var l = dungeons(), D = dget(dung);
    dsub.hidden = world !== 2 || !l.length;
    if (dsub.hidden) return;
    var sel = dsub.querySelector('select');
    var opts = l.map(function (x, i) { return '<option value="' + x.d + '"' + (x.d === dung ? ' selected' : '') + '>Dungeon ' + (i + 1) + (link && link.w === 2 && link.d === x.d ? ' \u2022 Link' : '') + '</option>'; }).join('');
    if (sel.innerHTML !== opts) sel.innerHTML = opts;
    var fl = dsub.querySelector('.z3m-floors'), h = '';
    if (D) for (var f = D.n - 1; f >= 0; f--) {
      if (D.rooms.slice(f * 25, f * 25 + 25).every(function (m) { return !m; })) continue;
      h += '<button type="button" data-f="' + f + '" aria-pressed="' + (f === dfloor) + '">' + floorName(D, f) + (link && link.w === 2 && link.d === D.d && link.f === f ? ' \u2022' : '') + '</button>';
    }
    if (fl.innerHTML !== h) fl.innerHTML = h;
  }

  // ── pins ─────────────────────────────────────────────────────────────────
  function pkey() { return 'rhb-z3map-pins:' + (gameId || (rom ? 'map-' + mapHash(rom) : 'x')); }
  function loadPins() { try { pins = JSON.parse(localStorage.getItem(pkey()) || '[]') || []; } catch (e) { pins = []; } }
  function savePins() { try { localStorage.setItem(pkey(), JSON.stringify(pins)); } catch (e) {} }
  function pinHere(p) { return p.w === world && (world !== 2 || (p.d === dung && p.f === dfloor)); }
  function addPin(w, x, y) {
    var name = prompt('What’s here? (a name for the pin)', ''); if (name === null) return;
    var pin = { w: w, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, n: name.trim().slice(0, 60) || 'Pin', t: Date.now() };
    if (w === 2) { pin.d = dung; pin.f = dfloor; }
    pins.push(pin);
    savePins(); sel = pins.length - 1; redraw();
  }

  // ── view ─────────────────────────────────────────────────────────────────
  function size() { var r = stage.getBoundingClientRect(); return [Math.max(50, r.width), Math.max(50, r.height)]; }
  function fit() {
    var s = size(), b = [0, 0, W, W], D = world === 2 ? dget(dung) : null;
    if (world === 2) b = D ? D.box : [0, 0, 5 * C, 5 * C];
    else if (rom) b = picture(world).box;
    var pad = world === 2 ? 14 : 2, bw = b[2] - b[0], bh = b[3] - b[1];
    zoom = Math.min((s[0] - pad * 2) / bw, (s[1] - pad * 2 - (world === 2 ? 14 : 0)) / bh);
    tx = (s[0] - bw * zoom) / 2 - b[0] * zoom; ty = (s[1] - bh * zoom) / 2 - b[1] * zoom + (world === 2 ? 7 : 0);
    moved = false; redraw();
  }
  function zoomAt(sx, sy, k) { var z = Math.max(0.3, Math.min(12, zoom * k)); k = z / zoom; tx = sx - (sx - tx) * k; ty = sy - (sy - ty) * k; zoom = z; moved = true; redraw(); }
  function setWorld(w, user) {
    if (w === world && (w === 2 || pics[w])) { if (user) { follow = false; followBtn.setAttribute('aria-pressed', 'false'); } return; }
    world = w; sel = -1;
    tabs.querySelectorAll('[data-w]').forEach(function (b) { b.setAttribute('aria-selected', +b.dataset.w === w ? 'true' : 'false'); });
    if (user) { follow = false; followBtn.setAttribute('aria-pressed', 'false'); }
    if (w === 2 && !dget(dung)) { var l = dungeons(); if (l.length) { dung = l[0].d; dfloor = l[0].below; } }
    paintSub();
    fit();
    if (onWorld) { try { onWorld(w); } catch (e) {} }
  }
  function redraw() { if (dirty) return; dirty = true; requestAnimationFrame(draw); }
  function draw() {
    dirty = false;
    if (!shown || !host.isConnected || host.offsetParent === null) return;
    var s = size(), dpr = Math.min(3, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(s[0] * dpr) || cv.height !== Math.round(s[1] * dpr)) { cv.width = Math.round(s[0] * dpr); cv.height = Math.round(s[1] * dpr); if (!moved) { dirty = false; fit(); return; } }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, s[0], s[1]);
    if (world === 2) drawDungeon(s);
    else { ctx.imageSmoothingEnabled = false; ctx.drawImage(picture(world), tx, ty, W * zoom, W * zoom); }
    // pins
    pins.forEach(function (p, i) {
      if (!pinHere(p)) return;
      var x = tx + p.x * zoom, y = ty + p.y * zoom;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 6, y - 12); ctx.arc(x, y - 14, 6.5, Math.PI * 0.85, Math.PI * 2.15); ctx.lineTo(x, y); ctx.closePath();
      ctx.fillStyle = i === sel ? '#fff' : '#ffd166'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = '#20232a'; ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y - 14, 2.5, 0, Math.PI * 2); ctx.fillStyle = '#20232a'; ctx.fill();
    });
    // Link (or where he went in)
    var l = world === 2 ? (link && link.w === 2 && link.d === dung && link.f === dfloor ? link : null)
      : link && link.w === world ? link : (lastOut && lastOut.w === world && (!link || link.indoors) ? lastOut : null);
    if (l) {
      var x = tx + l.x * zoom, y = ty + l.y * zoom, dim = world !== 2 && (!link || link.indoors);
      ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fillStyle = dim ? 'rgba(120,200,120,.2)' : 'rgba(80,220,100,.3)'; ctx.fill();
      ctx.beginPath(); ctx.arc(x, y, 4.5, 0, Math.PI * 2); ctx.fillStyle = dim ? '#6a9a6a' : '#3fe060'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
    }
    if (sel >= 0 && pins[sel] && pinHere(pins[sel])) {
      var p = pins[sel], lx = tx + p.x * zoom, ly = ty + p.y * zoom;
      label.hidden = false; label.querySelector('.n').textContent = p.n;
      var lw = label.offsetWidth, lh = label.offsetHeight;
      label.style.left = Math.max(4, Math.min(s[0] - lw - 4, lx - lw / 2)) + 'px';
      label.style.top = (ly - lh - 26 > 4 ? ly - lh - 26 : ly + 10) + 'px';
    } else label.hidden = true;
    atBtn.hidden = !(link && (!link.indoors ? world !== 2 : link.w === 2 && world === 2));
  }

  // ── pointer ──────────────────────────────────────────────────────────────
  var ptrs = new Map(), drag = null, pinch = null, lastTap = 0;
  function pos(e) { var r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
  function down(e) {
    if (e.button > 0) return;
    cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, pos(e));
    if (ptrs.size === 1) drag = { x: e.clientX, y: e.clientY, tx: tx, ty: ty, far: false };
    else if (ptrs.size === 2) { var v = Array.from(ptrs.values()), a = v[0], b = v[1]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), mx: (a[0] + b[0]) / 2, my: (a[1] + b[1]) / 2 }; drag = null; }
  }
  function move(e) {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.set(e.pointerId, pos(e));
    if (ptrs.size === 2 && pinch) {
      var v = Array.from(ptrs.values()), a = v[0], b = v[1], d = Math.hypot(a[0] - b[0], a[1] - b[1]), mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      if (pinch.d > 0) zoomAt(mx, my, d / pinch.d);
      tx += mx - pinch.mx; ty += my - pinch.my; pinch = { d: d, mx: mx, my: my }; moved = true; redraw();
    } else if (drag) {
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) drag.far = true;
      if (drag.far) { tx = drag.tx + dx; ty = drag.ty + dy; moved = true; redraw(); }
    }
  }
  function up(e) {
    if (!ptrs.has(e.pointerId)) return;
    var p = ptrs.get(e.pointerId); ptrs.delete(e.pointerId);
    if (ptrs.size < 2) pinch = null;
    if (drag && !drag.far && ptrs.size === 0) {
      var now = Date.now();
      if (placing) { setPlacing(false); addPin(world, (p[0] - tx) / zoom, (p[1] - ty) / zoom); }
      else if (now - lastTap < 300) { zoomAt(p[0], p[1], 2); lastTap = 0; }
      else { lastTap = now; tap(p[0], p[1]); }
    }
    if (ptrs.size === 0) drag = null;
  }
  function tap(x, y) {
    var best = -1, bd = 18;
    pins.forEach(function (p, i) { if (!pinHere(p)) return; var d = Math.hypot(tx + p.x * zoom - x, ty + p.y * zoom - (y + 12)); if (d < bd) { bd = d; best = i; } });
    sel = best === sel ? -1 : best; redraw();
  }
  function setPlacing(on) { placing = on; pinBtn.setAttribute('aria-pressed', String(on)); cv.style.cursor = on ? 'crosshair' : 'grab'; host.querySelector('.z3m-hint').textContent = on ? 'Tap the map where the pin goes' : ''; }

  // ── the game ─────────────────────────────────────────────────────────────
  function hide() { if (shown) { shown = false; host.hidden = true; if (onShow) { try { onShow(false); } catch (e) {} } } }
  function poll() {
    var P = typeof player === 'function' ? player() : player, core = P && P.core, r = null, wr = null;
    try { r = core && core.rom && core.rom(); wr = core && core.wram && core.wram(); } catch (e) {}
    if (!r || !wr || wr.length < 0x20000) { hide(); return; }
    if (r !== rom) { rom = (hackOnly ? isHack(r) : isZ3(r)) ? r : null; pics = {}; tabs.querySelector('[data-w="2"]').hidden = !(rom && dungeons().length); }
    if (!rom) { hide(); return; }
    if (!shown) { shown = true; host.hidden = false; loadPins(); setTimeout(fit, 0); if (onShow) { try { onShow(true); } catch (e) {} } }
    var mod = wr[0x10], area = wr[0x8A], indoors = !!wr[0x1B];
    var x = (wr[0x22] | wr[0x23] << 8) / 8, y = (wr[0x20] | wr[0x21] << 8) / 8;
    var playing = (mod === 0x07 || mod === 0x09 || mod === 0x0B || mod === 0x0E || mod === 0x10) && (indoors || (x < W && y < W));
    var was = link;
    if (!playing) link = null;
    else { link = { w: area & 0x40 ? 1 : 0, x: Math.min(x, W), y: Math.min(y, W), indoors: indoors }; if (!indoors) lastOut = link; }
    // in a dungeon: which one, the floor, the room and where in it
    var di = wr[0x40C];
    if (playing && indoors && di < 28 && !(di & 1)) {
      var D = dget(di >> 1), fl = ((wr[0xA4] << 24) >> 24), room = wr[0xA0] | wr[0xA1] << 8;
      if (D) {
        var f = D.below + fl, cell = f >= 0 && f < D.n ? cellOf(D, f, room) : -1;
        if (cell >= 0) {
          var lx = (wr[0x22] | wr[0x23] << 8) & 0x1FF, ly = (wr[0x20] | wr[0x21] << 8) & 0x1FF;
          link = { w: 2, d: D.d, f: f, cell: cell, room: room, x: ((cell % 5) + lx / 512) * C, y: (((cell / 5) | 0) + ly / 512) * C, indoors: true };
        }
      }
    }
    if (link && link.w === 2 && follow) {
      if (world !== 2 || dung !== link.d || dfloor !== link.f) { if (world !== 2) { dung = link.d; dfloor = link.f; setWorld(2, false); } else setDungeon(link.d, link.f, false); }
    } else if (link && !link.indoors && follow) {
      if (link.w !== world) setWorld(link.w, false);
      else if (!moved) { var s = size(), sx = tx + link.x * zoom, sy = ty + link.y * zoom; if (sx < 20 || sy < 20 || sx > s[0] - 20 || sy > s[1] - 20) { tx = s[0] / 2 - link.x * zoom; ty = s[1] / 2 - link.y * zoom; } }
    }
    if (!was !== !link || (link && was && (was.w !== link.w || was.f !== link.f || was.indoors !== link.indoors || Math.abs(was.x - link.x) > .2 || Math.abs(was.y - link.y) > .2))) { redraw(); if (world === 2 && (!was || !link || was.f !== link.f || was.d !== link.d)) paintSub(); }
    else if (world === 2 && ++dtick % 4 === 0) redraw();   // rooms seen, the map and compass picked up
  }

  window.Z3Map = {
    isHack: isHack, isZ3: isZ3, mapHash: mapHash,
    // the page's own tabs choose the world (no-op when it's already that one, so Follow stays on)
    view: function (w) { if (tabs && w !== world) setWorld(w, true); },
    get world() { return world; },
    setCompact: function (on) { if (z3root) { z3root.classList.toggle('compact', !!on); redraw(); } },
    addControl: function (el) { if (tabs) tabs.appendChild(el); },
    fit: function () { if (stage) fit(); },
    // the hack's dungeons and what Link holds for each (the Keys list)
    dungeonStatus: function () {
      if (!rom) return [];
      var wr = wram(); if (!wr) return [];
      var here = link && link.w === 2 ? link.d : -1, w16 = function (a) { return wr[a] | wr[a + 1] << 8; };
      return dungeons().map(function (D, i) {
        var bit = 0x8000 >> D.d, total = 0, seen = 0, done = {};
        D.rooms.forEach(function (m) { if (!m || done[m.room]) return; done[m.room] = 1; var sb = wr[0xF000 + m.room * 2] & 15; for (var k = 0; k < 4; k++) if (m.q[k]) { total++; if (sb & (8 >> k)) seen++; } });
        return { d: D.d, name: 'Dungeon ' + (i + 1), floors: floorName(D, 0) + (D.n > 1 ? '\u2013' + floorName(D, D.n - 1) : ''),
          map: !!(w16(0xF368) & bit), compass: !!(w16(0xF364) & bit), bigkey: !!(w16(0xF366) & bit),
          keys: here === D.d ? wr[0xF36F] : wr[0xF37C + D.d], here: here === D.d, seen: seen, total: total };
      });
    },
    showDungeon: function (d) { var D = dget(d); if (D) { if (world !== 2) { dung = d; dfloor = D.below; setWorld(2, true); } else setDungeon(d, D.below, true); } },
    attach: function (o) {
      player = o.player; host = o.host; gameId = o.gameId || ''; hackOnly = !!o.hackOnly; onShow = o.onShow || null; onWorld = o.onWorld || null;
      try { follow = localStorage.getItem('rhb-z3map-follow') !== 'off'; } catch (e) {}
      host.hidden = true;
      host.innerHTML = '<style>' +
        '.z3m { display: flex; flex-direction: column; height: 360px; border: 1px solid var(--line, #30363d); border-radius: 8px; overflow: hidden; background: #0b0f16; }' +
        '.z3m-tabs { display: flex; flex-wrap: wrap; align-items: center; gap: 2px; padding: 4px 4px 0; background: rgba(255,255,255,.04); border-bottom: 1px solid var(--line, #30363d); }' +
        '.z3m-tabs button { background: none; border: 0; padding: 6px 8px 7px; font: 500 13px/1 system-ui, sans-serif; color: var(--dim, #8b95a3); cursor: pointer; border-bottom: 3px solid transparent; margin-bottom: -1px; white-space: nowrap; }' +
        '.z3m-tabs button[aria-selected="true"] { color: #ffd166; border-bottom-color: #ffd166; }' +
        '.z3m-tabs .sp { flex: 1; } .z3m-tabs [aria-pressed="true"] { color: #3fe060; } .z3m-tabs .z3m-pin[aria-pressed="true"] { color: #ffd166; }' +
        '.z3m-stage { position: relative; flex: 1 1 0; min-height: 0; } .z3m-stage canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; cursor: grab; touch-action: none; }' +
        '.z3m-label { position: absolute; z-index: 2; background: rgba(12,16,26,.94); border: 1px solid var(--line, #30363d); border-radius: 6px; padding: 6px 8px; font-size: 12.5px; color: #e6edf3; display: flex; flex-direction: column; gap: 4px; max-width: 220px; }' +
        '.z3m-label[hidden], .z3m-at[hidden] { display: none; }' +
        '.z3m-label button { background: #1b2130; border: 1px solid #3a4556; color: #ff9f9f; border-radius: 4px; padding: 3px 6px; font-size: 12px; cursor: pointer; }' +
        '.z3m-hint { position: absolute; left: 0; right: 0; bottom: 0; text-align: center; font-size: 12px; color: #ffd166; padding: 4px; pointer-events: none; text-shadow: 0 1px 2px #000; }' +
        '.z3m-sub { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 6px; padding: 5px 6px; border-bottom: 1px solid var(--line, #30363d); font: 12px system-ui, sans-serif; color: var(--dim, #8b95a3); }' +
        '.z3m-sub[hidden], .z3m-tabs [hidden] { display: none; }' +
        '.z3m-sub select { background: #161b22; color: #e6edf3; border: 1px solid #2a313c; border-radius: 5px; padding: 3px 4px; font: inherit; }' +
        '.z3m-floors { display: inline-flex; gap: 3px; flex-wrap: wrap; } .z3m-floors button { background: #161b22; color: #c9d1d9; border: 1px solid #2a313c; border-radius: 5px; padding: 3px 7px; font: 600 12px system-ui, sans-serif; cursor: pointer; }' +
        '.z3m-floors button[aria-pressed="true"] { background: #ffd166; color: #20232a; border-color: #ffd166; }' +
        '.z3m-sub label { display: inline-flex; align-items: center; gap: 4px; margin-left: auto; cursor: pointer; }' +
        // compact: the page's own tabs pick the world; the map's controls float in its corner
        '.z3m.compact { position: relative; }' +
        // compact: the map's own controls sit in a slim row under the map, not over it
        '.z3m.compact .z3m-sub { order: 1; } .z3m.compact .z3m-stage { order: 2; } .z3m.compact .z3m-tabs { order: 3; }' +
        '.z3m.compact .z3m-tabs { justify-content: flex-end; padding: 2px 4px; gap: 2px; border-bottom: 0; border-top: 1px solid var(--line, #30363d); }' +
        '.z3m.compact .z3m-tabs [data-w="0"], .z3m.compact .z3m-tabs [data-w="1"], .z3m.compact .z3m-tabs .sp { display: none; }' +
        '.z3m.compact .z3m-tabs button { padding: 7px 9px; border-bottom: 0; margin: 0; font-size: 13px; }' +
        '.z3m.compact .z3m-tabs [data-w="2"][aria-selected="true"] { color: #ffd166; }' +
        '.z3m.compact .z3m-tabs .z3m-fit { display: inline-block; font-size: 15px; } .z3m.compact .z3m-reset { display: none; }' +
        '.z3m-reset { position: absolute; top: 6px; right: 6px; z-index: 3; width: 34px; height: 34px; border-radius: 8px; border: 1px solid #3a4556; background: rgba(12,16,26,.85); color: #e6edf3; font-size: 18px; line-height: 1; cursor: pointer; }' +
        '.z3m-tabs .z3m-fit { display: none; }' +
        '.z3m-about { color: var(--dim, #8b95a3); font-size: 12px; margin: 6px 0 0; }</style>' +
        '<div class="z3m"><div class="z3m-tabs" role="tablist">' + WORLDS.map(function (n, i) { return '<button type="button" role="tab" data-w="' + i + '">' + n + '</button>'; }).join('') +
        '<span class="sp"></span><button type="button" class="z3m-at" title="Drop a pin where Link stands" hidden>⌖ Pin at Link</button><button type="button" class="z3m-pin" aria-pressed="false" title="Drop a pin: tap the map where it goes">📍 Pin</button>' +
        '<button type="button" class="z3m-follow" aria-pressed="' + follow + '" title="Switch to the world or dungeon floor Link is in and keep him in view">⌖ Follow</button><button type="button" class="z3m-fit" title="Re-center and fit the map">\u27F2</button></div>' +
        '<div class="z3m-sub" hidden><select aria-label="Dungeon"></select><span class="z3m-floors"></span><label title="Every room, as with the map and compass (the game shows the rooms you\u2019ve seen, all of them once you have the map, the boss with the compass)"><input type="checkbox" class="z3m-all"> All rooms</label></div>' +
        '<div class="z3m-stage"><canvas></canvas><button type="button" class="z3m-reset" title="Re-center and fit the map">\u27F2</button><div class="z3m-label" hidden><span class="n"></span><button type="button">Remove pin</button></div><div class="z3m-hint"></div></div></div>' +
        '<p class="z3m-about">The hack’s own maps, from its ROM: the world map and its dungeon maps (rooms you’ve seen, all of them once you have the map). Link is the green dot; pins are yours, kept for this game.</p>';
      stage = host.querySelector('.z3m-stage'); cv = stage.querySelector('canvas'); ctx = cv.getContext('2d'); tabs = host.querySelector('.z3m-tabs'); label = host.querySelector('.z3m-label');
      followBtn = host.querySelector('.z3m-follow'); pinBtn = host.querySelector('.z3m-pin'); atBtn = host.querySelector('.z3m-at');
      tabs.querySelectorAll('[data-w]').forEach(function (b) { b.addEventListener('click', function () { setWorld(+b.dataset.w, true); }); });
      dsub = host.querySelector('.z3m-sub');
      dsub.querySelector('select').addEventListener('change', function (e) { var D = dget(+e.target.value); if (D) setDungeon(D.d, link && link.w === 2 && link.d === D.d ? link.f : D.below, true); });
      dsub.querySelector('.z3m-floors').addEventListener('click', function (e) { var b = e.target.closest('[data-f]'); if (b) setDungeon(dung, +b.dataset.f, true); });
      try { showAll = localStorage.getItem('rhb-z3map-allrooms') === 'on'; } catch (e) {}
      dsub.querySelector('.z3m-all').checked = showAll;
      dsub.querySelector('.z3m-all').addEventListener('change', function (e) { showAll = e.target.checked; try { localStorage.setItem('rhb-z3map-allrooms', showAll ? 'on' : 'off'); } catch (x) {} redraw(); });
      host.querySelector('.z3m-fit').addEventListener('click', fit);
      host.querySelector('.z3m-reset').addEventListener('click', function () { follow && link ? (moved = false, fit()) : fit(); });
      followBtn.addEventListener('click', function () { follow = !follow; followBtn.setAttribute('aria-pressed', String(follow)); try { localStorage.setItem('rhb-z3map-follow', follow ? 'on' : 'off'); } catch (e) {} if (follow) moved = false; });
      pinBtn.addEventListener('click', function () { setPlacing(!placing); });
      atBtn.addEventListener('click', function () { if (link && (!link.indoors || link.w === 2)) addPin(link.w, link.x, link.y); });
      label.querySelector('button').addEventListener('click', function () { if (sel >= 0) { pins.splice(sel, 1); sel = -1; savePins(); redraw(); } });
      cv.addEventListener('pointerdown', down); cv.addEventListener('pointermove', move); cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
      cv.addEventListener('wheel', function (e) { e.preventDefault(); var p = pos(e); zoomAt(p[0], p[1], Math.exp(-e.deltaY * 0.0022)); }, { passive: false });
      if (window.ResizeObserver) new ResizeObserver(function () { redraw(); }).observe(stage);
      tabs.querySelector('[data-w="0"]').setAttribute('aria-selected', 'true');
      z3root = host.querySelector('.z3m');
      setInterval(poll, 250);
    },
  };
})();
